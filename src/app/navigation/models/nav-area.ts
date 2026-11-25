import type { IconName } from '../../../generated/icons';
import type { NavSection } from './nav-section';

export interface NavArea {
  id: string;
  label: string;
  icon: IconName;
  sections: NavSection[];
}
