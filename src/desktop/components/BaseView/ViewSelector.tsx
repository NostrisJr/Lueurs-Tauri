import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { BaseViewEnum, type BaseViewType } from "../../../shared/lib/noteTypes";

interface Props {
  currentView: BaseViewType;
  kanbanAvailable: boolean;
  onChange: (view: BaseViewType) => void;
}

export function ViewSelector({
  currentView,
  kanbanAvailable,
  onChange,
}: Props) {
  return (
    <SegmentedControl
      options={[
        { value: BaseViewEnum.TABLE, label: "Tableau" },
        {
          value: BaseViewEnum.KANBAN,
          label: "Kanban",
          disabled: !kanbanAvailable,
          title: kanbanAvailable
            ? undefined
            : "Aucune propriété libre disponible pour le Kanban",
        },
      ]}
      value={currentView}
      onChange={onChange}
    />
  );
}
