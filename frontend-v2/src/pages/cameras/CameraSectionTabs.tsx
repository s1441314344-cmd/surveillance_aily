import { Button } from 'antd';
import { CAMERA_SECTIONS, type CameraSectionKey } from './cameraSections';

type CameraSectionTabsProps = {
  currentValue: CameraSectionKey;
  onChange: (key: CameraSectionKey) => void;
};

export function CameraSectionTabs({ currentValue, onChange }: CameraSectionTabsProps) {
  return (
    <div className="camera-segmented">
      {CAMERA_SECTIONS.map((section) => (
        <Button
          key={section.key}
          type="text"
          className={`camera-segmented__btn ${section.key === currentValue ? 'camera-segmented__btn--active' : ''}`}
          aria-pressed={section.key === currentValue}
          onClick={() => onChange(section.key)}
        >
          {section.label}
        </Button>
      ))}
    </div>
  );
}

