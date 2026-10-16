import { useMemo } from 'preact/hooks';
import { renderRich } from './markdown';

interface Props {
  text: string;
  class?: string;
  /** Als <span> ohne Absätze, z. B. innerhalb eines Buttons */
  inline?: boolean;
}

export function Rich({ text, class: className, inline = false }: Props) {
  const html = useMemo(() => renderRich(text, inline), [text, inline]);
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag class={`rich ${className ?? ''}`.trim()} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
