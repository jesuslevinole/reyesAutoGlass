import React from 'react';

// 👇 Agregamos 'color' al final de esta lista
export type FieldType = 'text' | 'number' | 'select' | 'color';

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
  icon: React.ElementType; 
  route: string; 
}