import { describe, expect, it } from 'vitest';

import { references } from './sky-service.js';

describe('card references', () => {
  it('groups by work, shows only reader passage numbers and credits the compilation last', () => {
    expect(
      references(
        [
          { sourceId: 'IBN-QUTAYBA-ANWA', locator: '§170 (local text L3102-3103)' },
          { sourceId: 'KUNITZSCH-1961', locator: 'no. 107a' },
          { sourceId: 'IBN-QUTAYBA-ANWA', locator: '§216 (local text L3710-3713)' },
          { sourceId: 'AL-MARZUQI-AZMINA', locator: 'local text L23784' },
        ],
        true,
      ),
    ).toEqual([
      { title: 'Ibn Qutayba, Kitab al-Anwa', detail: '§170, §216' },
      {
        title: 'Kunitzsch (1961), Untersuchungen zur Sternnomenklatur der Araber',
        detail: 'no. 107a',
      },
      { title: 'al-Marzuqi, Kitab al-Azmina wa-l-Amkina', detail: null },
      {
        title: 'Khalid al-Ajaji, Arabic (Ancient) sky culture for Stellarium (CC BY-ND 4.0)',
        detail: null,
      },
    ]);
  });

  it('keeps paragraph ranges whole', () => {
    expect(
      references([{ sourceId: 'IBN-QUTAYBA-ANWA', locator: '§170-171 (local text L1)' }], false),
    ).toEqual([{ title: 'Ibn Qutayba, Kitab al-Anwa', detail: '§170-171' }]);
  });
});
