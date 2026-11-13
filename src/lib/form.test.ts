import { describe, expect, it } from 'vitest';
import { emptyForm, formToInput, itemToForm, validateForm, type ItemFormValues } from './form';
import type { Item } from './types';

const TZ = 'America/Sao_Paulo';

function form(p: Partial<ItemFormValues>): ItemFormValues {
  return { ...emptyForm('task'), title: 'Algo', ...p };
}

describe('validateForm', () => {
  it('exige título', () => {
    expect(validateForm(form({ title: '  ' })).title).toBe('Informe um título');
  });
  it('compromisso exige data', () => {
    expect(validateForm(form({ kind: 'event', date: '' })).date).toBe('Compromissos precisam de data');
  });
  it('compromisso exige hora quando não é dia inteiro', () => {
    expect(validateForm(form({ kind: 'event', date: '2026-12-01', time: '', allDay: false })).time).toBe(
      'Informe a hora',
    );
  });
  it('fim deve ser depois do início', () => {
    expect(
      validateForm(form({ kind: 'event', date: '2026-12-01', time: '14:00', endTime: '13:00' })).endTime,
    ).toBe('O fim deve ser depois do início');
  });
  it('lembrete exige data', () => {
    expect(validateForm(form({ date: '', reminder: '10' })).reminder).toBe('Defina uma data para usar lembrete');
  });
  it('formulário válido não tem erros', () => {
    expect(validateForm(form({ date: '2026-12-01', time: '14:00', reminder: '10' }))).toEqual({});
  });
});

describe('formToInput', () => {
  it('converte data e hora locais para UTC', () => {
    const input = formToInput(form({ date: '2026-12-01', time: '14:30' }), TZ);
    expect(input.starts_at).toBe('2026-12-01T17:30:00.000Z');
    expect(input.timezone).toBe(TZ);
    expect(input.all_day).toBe(false);
  });
  it('dia inteiro guarda 00:00 no fuso e sem fim', () => {
    const input = formToInput(form({ kind: 'event', date: '2026-12-01', allDay: true, endTime: '15:00' }), TZ);
    expect(input.starts_at).toBe('2026-12-01T03:00:00.000Z');
    expect(input.ends_at).toBeNull();
    expect(input.all_day).toBe(true);
  });
  it('tarefa com data e sem hora vira dia inteiro', () => {
    const input = formToInput(form({ date: '2026-12-01', time: '' }), TZ);
    expect(input.all_day).toBe(true);
  });
  it('tarefa sem data não tem início nem lembrete', () => {
    const input = formToInput(form({ date: '', reminder: '10' }), TZ);
    expect(input.starts_at).toBeNull();
    expect(input.reminder_minutes).toBeNull();
  });
  it('converte hora de fim e lembrete', () => {
    const input = formToInput(
      form({ kind: 'event', date: '2026-12-01', time: '14:00', endTime: '15:30', reminder: '60', notes: ' x ' }),
      TZ,
    );
    expect(input.ends_at).toBe('2026-12-01T18:30:00.000Z');
    expect(input.reminder_minutes).toBe(60);
    expect(input.notes).toBe('x');
  });
});

describe('itemToForm', () => {
  it('faz a ida e volta', () => {
    const v = form({
      kind: 'event',
      category: 'leisure',
      title: 'Cinema',
      notes: 'Levar casaco',
      date: '2026-12-01',
      time: '19:00',
      endTime: '21:00',
      reminder: '60',
    });
    const input = formToInput(v, TZ);
    const it: Item = {
      ...input,
      id: '1',
      user_id: 'u',
      remind_at: null,
      reminder_sent_at: null,
      done_at: null,
      created_at: '',
      updated_at: '',
    };
    expect(itemToForm(it)).toEqual(v);
  });
});
