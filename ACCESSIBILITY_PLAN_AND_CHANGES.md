# isUD Website Accessibility Plan and Completed Changes

## Purpose

This document summarizes the accessibility support needed for the isUD website and the accessibility improvements already implemented in the latest development pass.

The practical accessibility target for this website should be WCAG 2.1 Level AA at minimum. WCAG 2.1 AA is the technical standard named in the ADA Title II web and mobile accessibility rule for state and local governments. Because WCAG 2.2 is newer and backward-compatible with WCAG 2.1, the preferred product target should be WCAG 2.2 AA where feasible.

## Accessibility Support Needed

### 1. Keyboard Accessibility

All interactive parts of the site must be usable without a mouse.

Needed support:

- Users must be able to tab through links, buttons, form fields, menus, modals, checklist controls, and admin tools.
- Focus order should match the visible page order.
- Menus and modals should open, close, and operate by keyboard.
- Escape should close temporary UI such as menus and dialogs.
- There should be no keyboard traps.

Important areas:

- Dashboard header account/admin menu
- Project checklist controls
- Add team member modal
- Project profile forms
- Admin approval and library editing pages

### 2. Visible Focus Indicators

Keyboard users need a clear visual indication of the active element.

Needed support:

- Links, buttons, inputs, selects, textareas, and custom controls need visible focus states.
- Focus styles must have sufficient contrast.
- Components should not remove outlines without replacing them with accessible focus styling.

### 3. Semantic HTML and Valid Interactive Elements

Assistive technologies rely on correct HTML structure.

Needed support:

- Use real buttons for actions.
- Use real links for navigation.
- Avoid nesting interactive elements, such as a button inside a link.
- Use landmarks such as header, nav, main, and footer appropriately.
- Use real table markup where content is tabular.

### 4. Accessible Forms

Forms need to be understandable and operable for screen reader users and keyboard users.

Needed support:

- Each input should have a programmatically associated label.
- Required fields should be clear beyond color alone.
- Error messages should be announced and connected to fields when possible.
- Custom radio buttons and checkboxes should remain keyboard focusable.
- Error and success states should use accessible live regions.

Important forms:

- Login
- Registration
- Password reset/recovery
- Account profile
- Project profile
- Team invitation modal
- Admin editing forms

### 5. Color Contrast

Text and controls must meet WCAG contrast requirements.

Needed support:

- Normal text should meet at least 4.5:1 contrast.
- Large text should meet at least 3:1 contrast.
- UI boundaries and focus indicators should be visibly distinguishable.
- Color should not be the only way status is communicated.

### 6. Screen Reader Announcements

Dynamic UI updates must be communicated to assistive technology.

Needed support:

- Autosave states should be announced.
- Error messages should use alert behavior.
- Success and status messages should use polite live regions.
- Icon-only buttons need accessible labels.
- Decorative icons should be hidden from screen readers.

### 7. Modal and Menu Accessibility

Temporary UI should behave predictably.

Needed support:

- Modals should identify themselves as dialogs.
- Focus should move into the modal when opened.
- Focus should return to the triggering control when closed.
- Keyboard focus should stay within an open modal.
- Menus should expose expanded/collapsed state.

### 8. Images and Figure Accessibility

The isUD site includes many instructional figures, so image accessibility is especially important.

Needed support:

- Meaningful figures should have descriptive alt text.
- Decorative images should use empty alt text.
- Captions should not be treated as a replacement for alt text when the image communicates important visual information.
- Admin figure upload/edit workflows should require or strongly encourage meaningful alt text.

### 9. Responsive Reflow and Zoom

Users should be able to zoom and use the site on small screens without losing content.

Needed support:

- Pages should be tested at 200% and 400% zoom.
- Dense dashboard and checklist layouts should not overlap or clip content.
- Tables and large grids should reflow or scroll in a predictable way.

### 10. Testing and Maintenance

Accessibility should be part of the development process.

Needed support:

- Run automated accessibility checks where possible.
- Manually test keyboard-only navigation.
- Perform screen reader smoke tests, especially on checklist and form flows.
- Test contrast after brand color or UI changes.
- Add accessibility checks to future development and QA workflows.

## Accessibility Changes Already Implemented

### 1. Global Focus Styling

Implemented a global `focus-visible` outline for common interactive elements.

Files changed:

- `src/app/globals.css`
- `src/components/ui/Button.tsx`

Result:

- Keyboard users can more easily see where focus is on the page.
- Shared buttons now include consistent focus ring styling.

### 2. Header Account/Admin Menu Accessibility

The dashboard account menu was previously hover-dependent. It now supports keyboard and click interaction.

File changed:

- `src/components/Header.tsx`

Changes made:

- Replaced hover-only behavior with controlled open/close state.
- Added `aria-haspopup="menu"`.
- Added `aria-expanded`.
- Added menu/menuitem roles.
- Added Escape-key close support.
- Added blur handling to close the menu when focus leaves.
- Marked decorative icons as hidden from screen readers.

Result:

- Keyboard users can access the account/admin menu.
- Screen readers can identify the menu state.

### 3. Project Table Call-To-Action Links

The project table previously wrapped button components inside links, creating nested interactive elements.

File changed:

- `src/components/ProjectTable.tsx`

Changes made:

- Replaced nested `Link > Button` patterns with links styled as buttons.
- Added accessible labels to project search controls.
- Connected sort and filter labels to their select fields.
- Marked decorative icons as hidden.

Result:

- Navigation CTAs now use valid HTML.
- Project controls are clearer for assistive technology.

### 4. Project Profile Checkbox Accessibility

Custom checkboxes for services and facility uses were previously hidden with `className="hidden"`, which removed them from keyboard navigation.

File changed:

- `src/components/ProjectProfileForm.tsx`

Changes made:

- Replaced hidden inputs with screen-reader-only focusable inputs.
- Added controlled `checked` state.
- Added focus-visible styling to custom checkbox visuals.
- Preserved the existing visual design.

Result:

- Keyboard users can tab to and operate the custom checkboxes.
- Screen readers can recognize and announce checkbox state.

### 5. Checklist Control Semantics

Checklist solution controls needed clearer accessible names and states.

File changed:

- `src/components/ChecklistSolutionItem.tsx`

Changes made:

- Added accessible labels to expand/collapse buttons.
- Added `aria-expanded` to expandable controls.
- Converted the implemented/not-implemented control to a switch pattern using `role="switch"`.
- Added `aria-checked`.
- Added a descriptive accessible label for the switch.
- Marked decorative icons as hidden.

Result:

- Screen reader users can understand solution details, figure expansion, and implementation status.
- Keyboard users get clearer control behavior.

### 6. Checklist Autosave Announcements

The checklist autosave state was previously only visual.

File changed:

- `src/app/(dashboard)/projects/[id]/checklist/page.tsx`

Changes made:

- Added `role="status"`.
- Added `aria-live="polite"`.
- Marked save-state icons as decorative.

Result:

- Assistive technology can announce "Saving", "Saved", or "Save failed" as the checklist state changes.

### 7. Login Form Message Announcements and Labels

Login and recovery messages needed accessible announcement behavior.

File changed:

- `src/components/LoginForm.tsx`

Changes made:

- Added `role="alert"` for error messages.
- Added `role="status"` and `aria-live="polite"` for success messages.
- Associated key login/recovery labels with inputs using `htmlFor` and `id`.
- Marked decorative icons as hidden.

Result:

- Login errors and success states are more accessible.
- Email and password fields are better identified by assistive technology.

### 8. Add Team Member Modal Accessibility

The add team member modal needed dialog semantics and focus handling.

File changed:

- `src/components/AddTeamMemberModal.tsx`

Changes made:

- Added `role="dialog"`.
- Added `aria-modal="true"`.
- Connected the dialog title with `aria-labelledby`.
- Moved focus into the dialog when it opens.
- Restored focus to the previous element when it closes.
- Added Escape-key close support.
- Added a basic focus trap.
- Replaced visual-only section label with a `fieldset` and `legend`.
- Connected labels to email and role controls.
- Added `role="alert"` for modal errors.
- Marked decorative icons as hidden.

Result:

- The modal behaves more predictably for keyboard and screen reader users.

### 9. Admin Approval Message Announcements

Admin project approval messages needed accessible status/error behavior.

File changed:

- `src/components/AdminProjectApprovalsClient.tsx`

Changes made:

- Added alert behavior for errors.
- Added polite status announcement for success messages.

Result:

- Admin approval results are more likely to be announced to assistive technology.

### 10. Invitation Banner Improvements

The invitation banner included icon controls that needed clearer accessibility.

File changed:

- `src/components/InvitationBanner.tsx`

Changes made:

- Added an accessible label to the dismiss button.
- Marked decorative icons as hidden.
- Updated the invitation accept button color to meet better contrast requirements.

Result:

- The banner is easier to understand and dismiss with assistive technology.

### 11. Accessible Brand Color Adjustment

The original bright orange did not meet WCAG AA contrast when used as text on white or as a background with white text.

Files changed:

- `src/app/globals.css`
- `src/components/ui/Button.tsx`
- `src/components/ProjectTable.tsx`
- `src/components/InvitationBanner.tsx`

Changes made:

- Changed the `secondary` color token to a darker accessible orange.
- Preserved the original bright orange as `accent` for decorative brand use.
- Updated secondary button hover color.
- Updated relevant button text colors for contrast.

Verified contrast:

- Secondary orange on white: 5.02:1
- White on secondary orange: 5.02:1
- White on secondary hover color: 7.09:1
- Bright accent orange on navy: 5.53:1
- Navy on white: 12.61:1

Result:

- The primary orange text and button combinations now better support WCAG AA contrast.

## Verification Completed

The following checks were run after implementation:

- `npm run lint`
- `npm run build`
- Manual contrast checks for key brand color combinations

Both lint and production build completed successfully.

## Remaining Recommended Work

The first pass addressed the most immediate keyboard, focus, contrast, and screen-reader issues. The following work is still recommended:

1. Add full `htmlFor` and `id` label associations across all registration, profile, project, and admin forms.
2. Add field-specific error associations using `aria-describedby` and `aria-invalid`.
3. Convert project/admin list layouts to semantic tables where appropriate.
4. Improve alt text requirements and editorial guidance for uploaded figures.
5. Run a browser-based automated accessibility scan with a tool such as axe.
6. Perform keyboard-only testing across all primary flows.
7. Perform screen reader smoke testing, especially for checklist, forms, menus, and modals.
8. Test page behavior at 200% and 400% zoom.
9. Review all existing PDFs and uploaded documents for accessibility requirements.

## Summary

The website now has stronger accessibility foundations: visible focus, better keyboard menu behavior, accessible custom checkboxes, clearer checklist control semantics, live status announcements, improved modal behavior, and more compliant color contrast.

Additional work remains, especially around full form labeling, semantic data tables, figure alt text governance, and automated/manual accessibility testing. This should be treated as an ongoing accessibility program rather than a one-time fix.
