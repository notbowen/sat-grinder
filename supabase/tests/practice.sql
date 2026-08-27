begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select is(private.normalize_rational('1/2'), '1/2', 'keeps a reduced fraction');
select is(private.normalize_rational('-4/6'), '-2/3', 'reduces a negative fraction');
select is(private.normalize_rational('0.50'), '1/2', 'normalizes decimals');
select is(private.normalize_rational('.33'), '33/100', 'accepts omitted leading zero');
select is(private.normalize_rational('-\frac{4}{6}'), '-2/3', 'normalizes LaTeX fractions');
select is(private.normalize_rational('1/0'), null, 'rejects a zero denominator');
select ok((private.grade_answer('mcq', array['B'], 'b') ->> 'correct')::boolean, 'grades MCQ case-insensitively');
select ok((private.grade_answer('spr', array['0.5'], '1/2') ->> 'correct')::boolean, 'grades equivalent numeric answers');
select ok(not (private.grade_answer('spr', array['0.5'], '1/0') ->> 'valid')::boolean, 'rejects invalid numeric responses');
select ok(not has_table_privilege('anon', 'public.questions', 'select'), 'anonymous users cannot read questions');
select ok(not has_table_privilege('authenticated', 'public.questions', 'select'), 'authenticated users cannot read answer keys directly');
select ok(not has_function_privilege('anon', 'public.get_dashboard(text,text)', 'execute'), 'anonymous users cannot call dashboard RPC');
select ok(has_function_privilege('authenticated', 'public.get_dashboard(text,text)', 'execute'), 'authenticated users can call dashboard RPC');
select ok(not has_function_privilege('anon', 'public.remove_friend(uuid)', 'execute'), 'anonymous users cannot remove friends');
select ok(has_function_privilege('authenticated', 'public.remove_friend(uuid)', 'execute'), 'authenticated users can remove their friends');
select ok(not has_function_privilege('authenticated', 'public.finalize_question_sync(uuid)', 'execute'), 'clients cannot finalize a sync');

select * from finish();
rollback;
