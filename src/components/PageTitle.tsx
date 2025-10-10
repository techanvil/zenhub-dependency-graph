import { useRef } from "react";

interface PageTitleProps {
  epic?: string;
}

export default function PageTitle({ epic }: PageTitleProps) {
  const previousEpic = useRef<string>();

  if (epic && previousEpic.current !== epic) {
    previousEpic.current = epic;
    document.title = `Epic: ${epic} - ZDG`;
  }

  return null;
}
