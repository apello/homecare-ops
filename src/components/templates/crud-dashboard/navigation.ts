// src/components/templates/crud-dashboard/navigation.ts
import * as React from 'react';

export type NavigationItem =
  | { kind: 'header'; title: string }
  | { kind: 'divider' }
  | {
      kind: 'page';
      id: string;
      title: string;
      icon?: React.ReactNode;
      href: string;
      children?: NavigationItem[];
    };