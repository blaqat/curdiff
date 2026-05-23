const ICON_LABELS: Record<string, string> = {
  bolt: 'Fast',
  brain: 'Thinking',
  zap: 'Fast',
};

const titleCase = (text: string) => text.replaceAll(/\b\w/g, (char) => char.toUpperCase());

export const formatSelectLabel = (label?: string, value?: string): string => {
  const candidate = (label?.trim() || value?.trim() || '').trim();
  if (!candidate) {
    return '';
  }

  const iconMatch = candidate.match(/^:icon-([a-z0-9-]+):$/i);
  if (iconMatch) {
    const iconName = iconMatch[1].toLowerCase();
    return ICON_LABELS[iconName] ?? titleCase(iconName.replaceAll('-', ' '));
  }

  if (candidate === 'false') {
    return 'Off';
  }

  if (candidate === 'true') {
    return 'On';
  }

  return candidate;
};
