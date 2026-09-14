import clsx from "clsx";
import { useAtom } from "jotai";
import type { ChangeEvent } from "react";
import { infoAuteurAtom } from "../../../../shared/lib/atoms";
import type { InfosAuteur } from "../../../../shared/lib/proseToTypst";

function Champ({
  label,
  field,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  field: keyof InfosAuteur;
  value: string;
  onChange: (field: keyof InfosAuteur, value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink-3">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange(field, e.target.value)
        }
        className={clsx(
          "px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1",
          "border-line-2 text-ink placeholder-ink-5 bg-surface",
          "focus:ring-line-3"
        )}
      />
    </div>
  );
}

export function AuteurTab() {
  const [auteur, setAuteur] = useAtom(infoAuteurAtom);

  function update(field: keyof InfosAuteur, value: string) {
    setAuteur((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-4 leading-relaxed">
        Ces informations peuvent être incluses sur la page de titre lors de
        l'export PDF (option "Bloc auteur").
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <Champ
            label="Prénom"
            field="prenom"
            value={auteur.prenom}
            onChange={update}
            placeholder="Marie"
          />
        </div>
        <div className="flex-1">
          <Champ
            label="Nom"
            field="nom"
            value={auteur.nom}
            onChange={update}
            placeholder="Dupont"
          />
        </div>
      </div>

      <Champ
        label="Adresse e-mail"
        field="email"
        value={auteur.email}
        onChange={update}
        placeholder="marie.dupont@exemple.fr"
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-3">Adresse</label>
        <textarea
          value={auteur.adresse}
          placeholder={"12 rue des Lilas\n75011 Paris"}
          onChange={(e) => update("adresse", e.target.value)}
          rows={3}
          className={clsx(
            "px-2.5 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 resize-none",
            "border-line-2 text-ink placeholder-ink-5 bg-surface",
            "focus:ring-line-3"
          )}
        />
      </div>
    </div>
  );
}
