import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ygkurkmosqyaabztzhgg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlna3Vya21vc3F5YWFienR6aGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxNzE5MzMsImV4cCI6MjA1MDc0NzkzM30._dNlDk2y8euGpZYAJYHLWR3cvAqh-BF5bvPNz4TEvXg'
);

async function main() {
  const { data: settings, error: settingsErr } = await supabase.from('salarycap_settings').select('*').single();
  const baseCap = settings?.salary_cap || 400;
  console.log('Base Cap: $' + baseCap + '\n');

  const { data: owners, error: ownersErr } = await supabase.from('salarycap_owners').select('*').eq('is_active', true).order('owner_name');
  const { data: contracts, error: contractsErr } = await supabase.from('salarycap_contracts').select('*');
  const { data: deadCap, error: deadCapErr } = await supabase.from('salarycap_dead_cap').select('*').gt('years_remaining', 0);
  const { data: bonusCap, error: bonusCapErr } = await supabase.from('salarycap_bonus_cap').select('*');

  console.log('Owners:', owners?.length || 0, 'error:', ownersErr);
  console.log('Contracts:', contracts?.length || 0, 'error:', contractsErr);
  console.log('DeadCap:', deadCap?.length || 0, 'error:', deadCapErr);
  console.log('BonusCap:', bonusCap?.length || 0, 'error:', bonusCapErr);
  console.log('');

  for (const owner of owners || []) {
    const active = (contracts || []).filter(c => c.owner_id === owner.id && c.contract_status === 'active');
    const sal = active.reduce((s, c) => s + c.salary, 0);
    const dead = (deadCap || []).filter(d => d.owner_id === owner.id).reduce((s, d) => s + d.amount, 0);
    const bonus = (bonusCap || []).filter(b => b.owner_id === owner.id).reduce((s, b) => s + (b.amount_2026 || 0), 0);
    const avail = baseCap + bonus - sal - dead;
    const bonusSign = bonus >= 0 ? '+' : '';

    console.log(owner.owner_name + ':');
    console.log('  Salaries: $' + sal + ' | Dead: $' + dead + ' | Bonus: ' + bonusSign + '$' + bonus + ' | Available: $' + avail + ' | Roster: ' + active.length);
  }
}

main();
