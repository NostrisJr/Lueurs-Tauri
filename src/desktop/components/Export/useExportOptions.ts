import { useAtom } from "jotai";
import {
  exportOptionsAtom,
  exportOptionsMultiDocAtom,
} from "../../../shared/lib/atoms";
import {
  OPTIONS_DEFAUT,
  OPTIONS_MULTI_DOC_DEFAUT,
  type OptionsExport,
  type OptionsMultiDocument,
} from "../../../shared/lib/proseToTypst";

export function useExportOptions() {
  const [storedOptions, setStoredOptions] = useAtom(exportOptionsAtom);
  const options: OptionsExport = { ...OPTIONS_DEFAUT, ...storedOptions };

  const [storedMultiOpts, setStoredMultiOpts] = useAtom(
    exportOptionsMultiDocAtom
  );
  const multiOpts: OptionsMultiDocument = {
    ...OPTIONS_MULTI_DOC_DEFAUT,
    ...storedMultiOpts,
  };

  function setOption<K extends keyof OptionsExport>(
    key: K,
    value: OptionsExport[K]
  ) {
    setStoredOptions((prev) => ({ ...prev, [key]: value }));
  }

  function setMultiOpt<K extends keyof OptionsMultiDocument>(
    key: K,
    value: OptionsMultiDocument[K]
  ) {
    setStoredMultiOpts((prev) => ({ ...prev, [key]: value }));
  }

  return { options, multiOpts, setOption, setMultiOpt };
}
