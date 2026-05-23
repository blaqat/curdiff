import { CaretDownIcon as CaretDown } from '@phosphor-icons/react/CaretDown';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

export type SearchableSelectOption = {
  id: string;
  label: string;
};

const MENU_GAP = 4;
const MENU_MARGIN = 8;
const MENU_Z_INDEX = 1000;

export const filterSelectOptions = (
  options: ReadonlyArray<SearchableSelectOption>,
  query: string,
): Array<SearchableSelectOption> => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...options];
  }

  return options.filter((option) => {
    const label = option.label.toLowerCase();
    const id = option.id.toLowerCase();
    return label.includes(normalized) || id.includes(normalized);
  });
};

export function SearchableSelect({
  compact = false,
  disabled = false,
  onChange,
  options,
  searchPlaceholder = 'Search…',
  title,
  value,
}: {
  compact?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: ReadonlyArray<SearchableSelectOption>;
  searchPlaceholder?: string;
  title?: string;
  value: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    visibility: 'hidden',
  });

  const fallbackOptions = useMemo(
    () => (options.length > 0 ? options : [{ id: value, label: value }]),
    [options, value],
  );
  const filteredOptions = useMemo(
    () => filterSelectOptions(fallbackOptions, query),
    [fallbackOptions, query],
  );
  const selectedOption = fallbackOptions.find((option) => option.id === value) ?? {
    id: value,
    label: value,
  };

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
    setMenuStyle({ visibility: 'hidden' });
  }, []);

  const scrollOptionIntoView = useCallback((index: number) => {
    const optionsEl = menuRef.current?.querySelector<HTMLElement>('.model-select-options');
    const optionEl = optionsEl?.children[index] as HTMLElement | undefined;
    optionEl?.scrollIntoView({ block: 'nearest' });
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuHeight = menuRect.height;
    const menuWidth = menuRect.width;
    const spaceAbove = triggerRect.top - MENU_MARGIN - MENU_GAP;
    const spaceBelow = window.innerHeight - triggerRect.bottom - MENU_MARGIN - MENU_GAP;

    let left = triggerRect.left;
    let top: number | undefined;
    let bottom: number | undefined;

    if (menuHeight <= spaceAbove || spaceAbove >= spaceBelow) {
      bottom = window.innerHeight - triggerRect.top + MENU_GAP;
    } else {
      top = triggerRect.bottom + MENU_GAP;
    }

    if (left + menuWidth > window.innerWidth - MENU_MARGIN) {
      left = window.innerWidth - MENU_MARGIN - menuWidth;
    }
    if (left < MENU_MARGIN) {
      left = MENU_MARGIN;
    }

    setMenuStyle({
      bottom,
      left,
      position: 'fixed',
      top,
      visibility: 'visible',
      zIndex: MENU_Z_INDEX,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updateMenuPosition();

    const focusSearch = () => searchRef.current?.focus({ preventScroll: true });
    focusSearch();
    const frame = requestAnimationFrame(focusSearch);
    return () => cancelAnimationFrame(frame);
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };

    const handleReposition = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      updateMenuPosition();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [closeMenu, open, updateMenuPosition]);

  const selectOption = useCallback(
    (optionId: string) => {
      onChange(optionId);
      closeMenu();
    },
    [closeMenu, onChange],
  );

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (filteredOptions.length === 0) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = (selectedIndex + 1) % filteredOptions.length;
        setSelectedIndex(nextIndex);
        scrollOptionIntoView(nextIndex);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const nextIndex = (selectedIndex - 1 + filteredOptions.length) % filteredOptions.length;
        setSelectedIndex(nextIndex);
        scrollOptionIntoView(nextIndex);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const option = filteredOptions[selectedIndex];
        if (option) {
          selectOption(option.id);
        }
      }
    },
    [closeMenu, filteredOptions, scrollOptionIntoView, selectOption, selectedIndex],
  );

  const menu = open ? (
    <div className="model-select-menu" ref={menuRef} style={menuStyle}>
      <input
        autoFocus
        className="model-select-search"
        onChange={(event) => {
          setQuery(event.target.value);
          setSelectedIndex(0);
        }}
        onKeyDown={handleSearchKeyDown}
        placeholder={searchPlaceholder}
        ref={searchRef}
        spellCheck={false}
        type="search"
        value={query}
      />
      <div className="model-select-options" role="listbox">
        {filteredOptions.length === 0 ? (
          <div className="model-select-empty">No matching options</div>
        ) : (
          filteredOptions.map((option, index) => (
            <button
              aria-selected={option.id === value}
              className={`model-select-option${option.id === value ? ' selected' : ''}${
                index === selectedIndex ? ' active' : ''
              }`}
              key={option.id}
              onClick={() => selectOption(option.id)}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={`model-select${compact ? ' compact' : ''}${open ? ' open' : ''}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="model-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onMouseDown={(event) => event.preventDefault()}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <span className="model-select-value">{selectedOption.label}</span>
        <CaretDown aria-hidden className="model-select-caret" size={12} weight="bold" />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
