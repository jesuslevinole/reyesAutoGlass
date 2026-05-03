import React from 'react';

export type FieldType = 'text' | 'number' | 'select';

export interface CatalogField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; 
}

export interface CatalogSchema {
  id: string;
  title: string;
  icon: React.ReactNode;
  fields: CatalogField[];
}

export interface SettingMenuOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}