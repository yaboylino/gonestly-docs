import type { IconName } from '../../../generated/icons';

export interface NavLink {
  id: string;
  label: string;
  icon: IconName;
  href: string;
}
