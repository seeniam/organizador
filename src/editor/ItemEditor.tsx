import clsx from 'clsx';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { friendlyError, useCreateItem, useItems, useUpdateItem } from '@/data/items';
import { deviceTimeZone } from '@/lib/dates';
import {
  emptyForm,
  formToInput,
  itemToForm,
  validateForm,
  type FormErrors,
  type ItemFormValues,
  type ReminderValue,
} from '@/lib/form';
import { useOnline } from '@/lib/online';
import { REMINDER_OPTIONS, type Item, type ItemKind } from '@/lib/types';
import { useCloseEditor } from '@/ui/editorNav';
import { useFilter } from '@/ui/filter';
import { IconTrash } from '@/ui/icons';
import { useItemActions } from '@/ui/ItemList';
import { Sheet } from '@/ui/Sheet';
import { useToast } from '@/ui/Toast';

export function ItemEditor() {
  const [params] = useSearchParams();
  const itemId = params.get('item');
  const novo = params.get('novo') as ItemKind | null;
  const date = params.get('data') ?? '';
  const { data: items, isPending, isFetching } = useItems();
  const close = useCloseEditor();
  const toast = useToast();

  const item = itemId ? items?.find((i) => i.id === itemId) : undefined;
  // Com cache restaurado, a lista pode estar velha: só decide depois da busca terminar.
  const notFound = !!itemId && !isPending && !isFetching && !item;

  useEffect(() => {
    if (notFound) {
      toast.show('Item não encontrado');
      close();
    }
  }, [notFound, toast, close]);

  if (item) return <EditorForm key={item.id} item={item} onClose={close} />;
  if (novo === 'task' || novo === 'event')
    return <EditorForm key={`novo-${novo}-${date}`} kind={novo} date={date} onClose={close} />;
  return null;
}

function EditorForm({ item, kind, date, onClose }: { item?: Item; kind?: ItemKind; date?: string; onClose(): void }) {
  const online = useOnline();
  const create = useCreateItem();
  const update = useUpdateItem();
  const actions = useItemActions();
  const toast = useToast();
  const [filter] = useFilter();
  const [v, setV] = useState<ItemFormValues>(() =>
    item ? itemToForm(item) : emptyForm(kind ?? 'task', date ?? '', filter === 'leisure' ? 'leisure' : 'work'),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const busy = create.isPending || update.isPending;
  const isEvent = v.kind === 'event';

  const set = <K extends keyof ItemFormValues>(k: K, value: ItemFormValues[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateForm(v);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const onError = (err: unknown) => toast.show(friendlyError(err));
    if (item) {
      update.mutate(
        { id: item.id, patch: formToInput(v, item.timezone) },
        {
          onError,
          onSuccess: () => {
            onClose();
            toast.show('Alterações salvas');
          },
        },
      );
    } else {
      create.mutate(formToInput(v, deviceTimeZone()), {
        onError,
        onSuccess: () => {
          onClose();
          toast.show(isEvent ? 'Compromisso criado' : 'Tarefa criada');
        },
      });
    }
  }

  const title = item
    ? isEvent
      ? 'Editar compromisso'
      : 'Editar tarefa'
    : isEvent
      ? 'Novo compromisso'
      : 'Nova tarefa';

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 pt-2">
        <Segmented
          legend="Tipo"
          name="kind"
          value={v.kind}
          onChange={(k) => set('kind', k as ItemKind)}
          options={[
            { value: 'task', label: 'Tarefa' },
            { value: 'event', label: 'Compromisso' },
          ]}
        />

        <Field label="Título" id="f-title" error={errors.title}>
          <input
            id="f-title"
            data-autofocus
            value={v.title}
            maxLength={200}
            onChange={(e) => set('title', e.target.value)}
            placeholder={isEvent ? 'Ex.: Consulta no dentista' : 'Ex.: Enviar relatório'}
            className={inputCls(!!errors.title)}
            aria-invalid={!!errors.title}
          />
        </Field>

        <Segmented
          legend="Categoria"
          name="category"
          value={v.category}
          onChange={(c) => set('category', c as ItemFormValues['category'])}
          options={[
            { value: 'work', label: 'Profissional', tone: 'work' },
            { value: 'leisure', label: 'Lazer', tone: 'leisure' },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" id="f-date" error={errors.date} className="col-span-2 sm:col-span-1">
            <input
              id="f-date"
              type="date"
              value={v.date}
              onChange={(e) => {
                set('date', e.target.value);
                if (!e.target.value) set('reminder', '');
              }}
              className={inputCls(!!errors.date)}
              aria-invalid={!!errors.date}
            />
          </Field>
          {!(isEvent && v.allDay) && (
            <Field label="Hora" id="f-time" error={errors.time} hint={isEvent ? undefined : 'Opcional'}>
              <input
                id="f-time"
                type="time"
                value={v.time}
                onChange={(e) => set('time', e.target.value)}
                className={inputCls(!!errors.time)}
                aria-invalid={!!errors.time}
              />
            </Field>
          )}
          {isEvent && !v.allDay && (
            <Field label="Hora de fim" id="f-end" error={errors.endTime} hint="Opcional">
              <input
                id="f-end"
                type="time"
                value={v.endTime}
                onChange={(e) => set('endTime', e.target.value)}
                className={inputCls(!!errors.endTime)}
                aria-invalid={!!errors.endTime}
              />
            </Field>
          )}
        </div>

        {isEvent && (
          <label className="flex items-center gap-3 font-bold">
            <input
              type="checkbox"
              checked={v.allDay}
              onChange={(e) => set('allDay', e.target.checked)}
              className="h-5 w-5 accent-[var(--c-work)]"
            />
            Dia inteiro
          </label>
        )}

        <Field label="Lembrete" id="f-reminder" error={errors.reminder}>
          <select
            id="f-reminder"
            value={v.reminder}
            disabled={!v.date}
            onChange={(e) => set('reminder', e.target.value as ReminderValue)}
            className={inputCls(!!errors.reminder)}
          >
            {REMINDER_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value === null ? '' : String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          {!v.date && <p className="mt-1 text-sm text-muted">Escolha uma data para ativar o lembrete.</p>}
          {v.date && (v.allDay || !v.time) && v.reminder !== '' && (
            <p className="mt-1 text-sm text-muted">Sem hora definida, o lembrete considera 9h do dia.</p>
          )}
        </Field>

        <Field label="Anotação" id="f-notes" hint="Opcional">
          <textarea
            id="f-notes"
            rows={3}
            maxLength={5000}
            value={v.notes}
            onChange={(e) => set('notes', e.target.value)}
            className={clsx(inputCls(false), 'resize-y')}
          />
        </Field>

        {!online && <p className="text-sm font-bold text-danger">Sem conexão. Conecte-se para salvar.</p>}

        <div className="sticky bottom-0 -mx-5 flex items-center gap-2 border-t border-line bg-surface px-5 pt-4 pb-1">
          {item && (
            <button
              type="button"
              disabled={!online}
              onClick={() => actions.remove(item, onClose)}
              className="flex items-center gap-2 rounded-xl px-3 py-3 font-bold text-danger hover:bg-sunken disabled:opacity-40"
            >
              <IconTrash width={20} height={20} />
              Excluir
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-xl px-4 py-3 font-bold text-muted hover:bg-sunken"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!online || busy}
            className="rounded-xl bg-ink px-6 py-3 font-bold text-bg disabled:opacity-40"
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function inputCls(error: boolean) {
  return clsx(
    'w-full rounded-xl border bg-bg px-3.5 py-3 text-base disabled:opacity-50',
    error ? 'border-danger' : 'border-line focus:border-ink',
  );
}

function Field({
  label,
  id,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Segmented({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: string;
  options: { value: string; label: string; tone?: 'work' | 'leisure' }[];
  onChange(v: string): void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-bold">{legend}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <label
              key={o.value}
              className={clsx(
                'flex cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 font-bold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent',
                active ? 'bg-surface text-ink shadow-sm' : 'text-muted',
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={active}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.tone && (
                <span
                  aria-hidden="true"
                  className={clsx('h-2.5 w-2.5 rounded-full', o.tone === 'work' ? 'bg-work' : 'bg-leisure')}
                />
              )}
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
