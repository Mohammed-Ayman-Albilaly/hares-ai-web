import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TableScroller } from './layout';

/**
 * The scroll box around every table. A table wider than its card scrolls
 * sideways, and a keyboard user can only scroll a box that can take focus, so
 * the box must be a focusable, named region (axe: scrollable-region-focusable).
 */
describe('TableScroller', () => {
  it('is a focusable region named after the table caption', () => {
    const caption = 'سجل الأحداث';
    const { container } = render(
      <TableScroller label={caption}>
        <table>
          <caption className="sr-only">{caption}</caption>
          <tbody>
            <tr>
              <td>1</td>
            </tr>
          </tbody>
        </table>
      </TableScroller>,
    );

    const region = screen.getByRole('group', { name: caption });
    expect(region).toBe(container.firstElementChild);
    expect(region).toHaveClass('overflow-x-auto');
    expect(region).toHaveAttribute('tabindex', '0');

    (region as HTMLElement).focus();
    expect(document.activeElement).toBe(region);
  });
});
