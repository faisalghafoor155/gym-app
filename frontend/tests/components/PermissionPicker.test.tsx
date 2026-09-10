import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PermissionPicker from '../../src/components/team/PermissionPicker';
import { STAFF_PERMISSIONS } from '../../src/utils/permissions';

/**
 * The control an owner uses to decide what a staff account can reach.
 *
 * Worth testing beyond "it renders" because it is the one place the gym hands
 * out access, and the sidebar the staff member ends up with is built from the
 * very flags shown here. The two modals that use it — creating an account and
 * changing one — previously carried their own hardcoded copies of the list,
 * which is how the labels came to read "Members Manager (Members Manager)".
 */

const renderPicker = (permission: Parameters<typeof PermissionPicker>[0]['value'] = 'manager') => {
  const onChange = vi.fn();
  render(<PermissionPicker id="perm" value={permission} onChange={onChange} />);
  return onChange;
};

describe('PermissionPicker', () => {
  it('offers every level the schema defines, so none can go missing', () => {
    renderPicker();

    const options = screen.getAllByRole('option').map(o => o.textContent);
    expect(options).toHaveLength(Object.keys(STAFF_PERMISSIONS).length);
  });

  it('leads with the widest access and ends with the narrowest', () => {
    renderPicker();

    // Order is the owner's reading order, not the generator's alphabetical
    // one, which used to bury Manager between Inventory and Members.
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
      'Full Access',
      'Members Manager',
      'Account',
      'Attendance',
      'Inventory Manager',
    ]);
  });

  it('names each level once, not twice in its own parentheses', () => {
    renderPicker();

    for (const option of screen.getAllByRole('option')) {
      expect(option.textContent).not.toMatch(/\(/);
    }
  });

  it('describes what the selected level is for', () => {
    renderPicker('receptionist');

    expect(
      screen.getByText(/check in members, view attendance/i),
    ).toBeInTheDocument();
  });

  it('shows the capabilities the level grants', () => {
    renderPicker('inventory_manager');

    expect(screen.getByText('Supplements')).toBeInTheDocument();
    expect(screen.getByText('Sell supplements')).toBeInTheDocument();
  });

  it('leaves out the capabilities it withholds', () => {
    renderPicker('receptionist');

    // The boundary is the point: a receptionist checking people in must not
    // read as somebody who can also take their money.
    expect(screen.queryByText('Record payments')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff & logins')).not.toBeInTheDocument();
  });

  it('reports the level the owner picked', async () => {
    const onChange = renderPicker('receptionist');

    await userEvent.selectOptions(screen.getByRole('combobox'), 'accountant');

    expect(onChange).toHaveBeenCalledWith('accountant');
  });
});
