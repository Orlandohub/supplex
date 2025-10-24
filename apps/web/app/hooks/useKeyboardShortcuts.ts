/**
 * Keyboard Shortcuts Hook
 * Handles global keyboard shortcuts for the application
 */

import { useEffect } from "react";
import { useNavigationStore } from "~/stores/navigationStore";

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts() {
  const { toggleSidebar } = useNavigationStore();

  useEffect(() => {
    const shortcuts: KeyboardShortcut[] = [
      {
        key: "b",
        ctrlKey: true,
        metaKey: true, // ⌘ on Mac
        handler: toggleSidebar,
        description: "Toggle sidebar",
      },
      {
        key: "k",
        ctrlKey: true,
        metaKey: true, // ⌘ on Mac
        handler: () => {
          // Focus on search input when Ctrl+K or ⌘K is pressed
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[type="text"][placeholder*="Search"]'
          );
          if (searchInput) {
            searchInput.focus();
          }
        },
        description: "Focus search",
      },
    ];

    function handleKeyDown(event: KeyboardEvent) {
      // Don't trigger shortcuts when user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Exception: Allow Ctrl+K / ⌘K even in inputs (for search)
        if (
          (event.key === "k" || event.key === "K") &&
          (event.ctrlKey || event.metaKey)
        ) {
          // Allow it to proceed
        } else {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const keyMatches =
          event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrlKey ? event.ctrlKey : true;
        const metaMatches = shortcut.metaKey ? event.metaKey : true;
        const shiftMatches = shortcut.shiftKey
          ? event.shiftKey
          : !event.shiftKey;
        const altMatches = shortcut.altKey ? event.altKey : !event.altKey;

        // Check if either Ctrl or Meta (⌘) is pressed when both are specified
        const modifierMatches =
          shortcut.ctrlKey && shortcut.metaKey
            ? event.ctrlKey || event.metaKey
            : ctrlMatches && metaMatches;

        if (
          keyMatches &&
          modifierMatches &&
          shiftMatches &&
          altMatches &&
          !event.repeat
        ) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleSidebar]);
}
