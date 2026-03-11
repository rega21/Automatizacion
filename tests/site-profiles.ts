import type { Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

type ActionKind = 'roleButton' | 'roleLink' | 'roleHeading' | 'roleNavigation' | 'css';
const ACTION_KINDS: ActionKind[] = ['roleButton', 'roleLink', 'roleHeading', 'roleNavigation', 'css'];

export type WalkAction = {
  step: string;
  kind: ActionKind;
  name: string;
  optional?: boolean;
  exact?: boolean;
  closeWithEscape?: boolean;
};

export type SiteProfile = {
  id: string;
  defaultUrl: string;
  homeChecks: WalkAction[];
  navigationActions: WalkAction[];
  utilityActions: WalkAction[];
  mutationAction?: WalkAction;
};

const PROFILES: Record<string, SiteProfile> = {
  // Starter profile for a new target site: replace URL and selector names.
  starter: {
    id: 'starter',
    defaultUrl: 'https://tu-sitio.com/',
    homeChecks: [{ step: 'Validate home hero heading', kind: 'roleHeading', name: 'Inicio', exact: false, optional: true }],
    navigationActions: [
      { step: 'Open first navigation link', kind: 'roleLink', name: 'Productos', exact: false, optional: true },
      { step: 'Open second navigation link', kind: 'roleLink', name: 'Contacto', exact: false, optional: true }
    ],
    utilityActions: [
      { step: 'Open menu button', kind: 'roleButton', name: 'Menu', exact: false, optional: true, closeWithEscape: true },
      { step: 'Open search button', kind: 'roleButton', name: 'Buscar', exact: false, optional: true, closeWithEscape: true }
    ]
  },
  fobalfoca: {
    id: 'fobalfoca',
    defaultUrl: 'https://fobalfoca5.vercel.app/',
    homeChecks: [{ step: 'Bottom navigation is visible', kind: 'roleNavigation', name: 'Bottom Navigation' }],
    navigationActions: [
      { step: 'Open Partido tab', kind: 'roleButton', name: 'Partido' },
      { step: 'Open Historial tab', kind: 'roleButton', name: 'Historial' },
      { step: 'Return to Jugadores tab', kind: 'roleButton', name: 'Jugadores' }
    ],
    utilityActions: [
      { step: 'Open menu', kind: 'roleButton', name: 'Abrir menú', closeWithEscape: true },
      { step: 'Open search', kind: 'roleButton', name: 'Buscar', exact: false, closeWithEscape: true },
      { step: 'Open add flow', kind: 'roleButton', name: 'Agregar', exact: false, optional: true, closeWithEscape: true }
    ],
    mutationAction: { step: 'Vote for first player', kind: 'roleButton', name: 'VOTAR', exact: false, optional: true }
  },
  academybugs: {
    id: 'academybugs',
    defaultUrl: 'https://academybugs.com/',
    homeChecks: [{ step: 'Examples section text is visible', kind: 'css', name: 'text=Examples of Bugs', optional: true }],
    navigationActions: [
      { step: 'Open Types of Bugs page', kind: 'roleLink', name: 'Types of Bugs' },
      { step: 'Open Find Bugs page', kind: 'roleLink', name: 'Find Bugs' },
      { step: 'Open Report Bugs page', kind: 'roleLink', name: 'Report Bugs' },
      { step: 'Return to Examples page', kind: 'roleLink', name: 'Examples of Bugs', exact: false }
    ],
    utilityActions: []
  },
  generic: {
    id: 'generic',
    defaultUrl: 'https://example.com/',
    homeChecks: [],
    navigationActions: [],
    utilityActions: []
  }
};

function isActionKind(value: unknown): value is ActionKind {
  return typeof value === 'string' && ACTION_KINDS.includes(value as ActionKind);
}

function toWalkActions(value: unknown): WalkAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: WalkAction[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const raw = item as Record<string, unknown>;
    if (typeof raw.step !== 'string' || typeof raw.name !== 'string' || !isActionKind(raw.kind)) {
      continue;
    }

    parsed.push({
      step: raw.step,
      name: raw.name,
      kind: raw.kind,
      optional: typeof raw.optional === 'boolean' ? raw.optional : undefined,
      exact: typeof raw.exact === 'boolean' ? raw.exact : undefined,
      closeWithEscape: typeof raw.closeWithEscape === 'boolean' ? raw.closeWithEscape : undefined
    });
  }

  return parsed;
}

export function loadProfileFromFile(profileFile: string): SiteProfile {
  const resolvedPath = path.isAbsolute(profileFile) ? profileFile : path.resolve(process.cwd(), profileFile);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Profile file not found: ${resolvedPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch {
    throw new Error(`Invalid JSON in profile file: ${resolvedPath}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid profile format in file: ${resolvedPath}`);
  }

  const raw = parsed as Record<string, unknown>;
  const mutationActions = toWalkActions(raw.mutationAction ? [raw.mutationAction] : []);

  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : 'custom-file-profile',
    defaultUrl: typeof raw.defaultUrl === 'string' && raw.defaultUrl.trim() ? raw.defaultUrl : 'https://example.com/',
    homeChecks: toWalkActions(raw.homeChecks),
    navigationActions: toWalkActions(raw.navigationActions),
    utilityActions: toWalkActions(raw.utilityActions),
    mutationAction: mutationActions[0]
  };
}

function toAccessibleName(name: string, exact?: boolean): string | RegExp {
  if (exact === false) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  }

  return name;
}

export function resolveProfile(profileName: string, profileFile?: string): SiteProfile {
  if (profileFile && profileFile.trim()) {
    return loadProfileFromFile(profileFile);
  }

  return PROFILES[profileName] ?? PROFILES.generic;
}

export function createLocator(page: Page, action: WalkAction): Locator {
  const accessibleName = toAccessibleName(action.name, action.exact);

  switch (action.kind) {
    case 'roleButton':
      return page.getByRole('button', { name: accessibleName }).first();
    case 'roleLink':
      return page.getByRole('link', { name: accessibleName }).first();
    case 'roleHeading':
      return page.getByRole('heading', { name: accessibleName }).first();
    case 'roleNavigation':
      return page.getByRole('navigation', { name: accessibleName }).first();
    case 'css':
      return page.locator(action.name).first();
    default:
      return page.locator('body');
  }
}
