import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// Route screens are loaded on first visit (dynamic import); the first one can take over a second.
import { configure } from '@testing-library/react';

configure({ asyncUtilTimeout: 8000 });
