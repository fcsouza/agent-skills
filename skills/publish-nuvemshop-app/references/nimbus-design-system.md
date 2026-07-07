# Nimbus Design System

Source extraction: Firecrawl map of 391 Nimbus URLs plus key pt-BR pages on 2026-07-07.

## Use Cases

Use Nimbus guidance when building or reviewing Nuvemshop embedded/admin app UI, publication readiness, design homologation, or UI consistency. Embedded apps are expected to use Nimbus and comply with Nuvemshop design requirements.

## Main Areas

Nimbus docs are organized around:

- Atomic components.
- Composite components.
- Patterns.
- Templates.
- Tokens.
- Resources such as Figma libraries, fonts, themes, and Nimbus icons.
- Tools such as coverage and migrator.

## Atomic Components

Atomic components include:

- Badge: communicate item counts or pending actions.
- Box: base layout/container primitive.
- Button: primary command/action.
- Checkbox: boolean/multiple selection.
- Chip: compact selected item/filter/status.
- Divider: visual separation.
- File uploader: file selection/upload UI.
- Icon Button: icon-only action when context makes the action clear.
- Icon: Nimbus iconography.
- Input: text entry/editing.
- Label: field/control label.
- Link: navigation/reference.
- List: structured list content.
- Popover: contextual floating content.
- Progress Bar: progress indication.
- Radio: mutually exclusive selection.
- Select: choose one option from a list.
- Skeleton: loading placeholder.
- Slider: numeric/range control.
- Spinner: loading indicator.
- Stack: spacing/layout composition.
- Tag: categorization/status label.
- Text: body/inline text.
- Textarea: multi-line text.
- Thumbnail: image/media preview.
- Title: heading text.
- Toast: transient feedback.
- Toggle: binary on/off setting.
- Tooltip: short contextual explanation.

## Composite Components

Composite components include:

- Accordion.
- Alert.
- Card: group related content/actions.
- Modal: intrusive floating dialog that changes focus from the background; use when interruption is warranted.
- Pagination.
- Scroll Pane.
- Segmented Control.
- Sidebar.
- SplitButton: primary action plus dropdown of extra actions.
- Stepper.
- Table: tabular data organization.
- Tabs: same-hierarchy content in separate tabs.

## Patterns

Nimbus patterns include:

- App Shell.
- Calendar.
- Callout Card: highlight relevant/contextual content or recommended action.
- Chat Input.
- Data List.
- Data Table: structured rows/columns for large data like products, orders, or customers with efficient comparison and actions.
- Editor.
- Empty Message: explain empty state and guide next action.
- Form Field: input/select/textarea plus label, helper text, and validation messages.
- Help Link.
- Initial Screen.
- Interactive List.
- Layout.
- Menu Button.
- Menu.
- Nav Tabs: mobile-friendly equal-hierarchy navigation.
- Page: main view container with hierarchy, title, description, and actions.
- Plan Display.
- Product Data List.
- Product Updates.
- Side Modal: lateral overlay for secondary flows without losing main context.
- Sortable.
- Summary Stats.
- Thumbnail With Action.

## Templates

Nimbus page templates include:

- Settings page.
- Confirmation modal.
- Form page.
- Basic page.
- Login screen.
- Simple list page.
- Product list page.
- Landing page.

Use templates first when an app surface matches one of these common tasks. They are specifically referenced by Nuvemshop design/homologation requirements.

## Tokens

Token families:

- Color.
- Typography.
- Breakpoint.
- Shadow.
- Shape.
- Spacing.
- zIndex.

Use tokens instead of arbitrary values when implementing embedded/admin app UI.

## Review Checklist

- Use Nimbus atomic/composite components before custom components.
- Use patterns for common app workflows: forms, tables, empty states, page shells, side modals, stats, navigation.
- Use page templates for settings, forms, lists, login, product lists, confirmation modals, and landing pages.
- Use Nimbus tokens for spacing, typography, color, shape, shadow, breakpoints, and z-index.
- Ensure loading, empty, error, success, and validation states exist.
- Keep UI language aligned with selected publication geographies.
- Avoid custom UI that breaks Nuvemshop admin expectations unless the app has a strong functional reason.
