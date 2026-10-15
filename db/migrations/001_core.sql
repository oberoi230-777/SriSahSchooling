-- gen_random_uuid() is built into PostgreSQL 13+; pgcrypto is not required.

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  country text NOT NULL DEFAULT 'IN',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  join_code_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('parent','student','teacher','admin')),
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending')),
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id)
);

CREATE TABLE IF NOT EXISTS email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify','reset','invite')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_tokens_user_purpose_idx ON email_tokens(user_id, purpose, expires_at DESC);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  linked_user_id uuid,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  grade_year text NOT NULL,
  country text NOT NULL,
  school text NOT NULL DEFAULT '',
  curriculum text NOT NULL,
  subjects text[] NOT NULL DEFAULT ARRAY[]::text[],
  current_level text NOT NULL DEFAULT '',
  learning_goals text NOT NULL DEFAULT '',
  improvement_areas text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id),
  FOREIGN KEY (linked_user_id, org_id) REFERENCES users(id, org_id) ON DELETE SET NULL (linked_user_id)
);
CREATE INDEX IF NOT EXISTS students_org_created_idx ON students(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS student_guardians (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  guardian_user_id uuid NOT NULL,
  relationship text NOT NULL DEFAULT 'Parent',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, guardian_user_id),
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (guardian_user_id, org_id) REFERENCES users(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS student_guardians_guardian_idx ON student_guardians(guardian_user_id, student_id);

CREATE TABLE IF NOT EXISTS teacher_assignments (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  student_id uuid NOT NULL,
  subject text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_user_id, student_id, subject),
  FOREIGN KEY (teacher_user_id, org_id) REFERENCES users(id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS teacher_assignments_student_idx ON teacher_assignments(student_id, teacher_user_id);

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  curriculum text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 45 CHECK (duration_minutes BETWEEN 10 AND 240),
  meeting_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id),
  FOREIGN KEY (teacher_user_id, org_id) REFERENCES users(id, org_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS classes_org_starts_idx ON classes(org_id, starts_at);

CREATE TABLE IF NOT EXISTS class_enrollments (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, student_id),
  FOREIGN KEY (class_id, org_id) REFERENCES classes(id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS class_enrollments_student_idx ON class_enrollments(student_id, class_id);

CREATE TABLE IF NOT EXISTS homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  class_id uuid,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id, student_id),
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (class_id, org_id) REFERENCES classes(id, org_id) ON DELETE SET NULL (class_id)
);
CREATE INDEX IF NOT EXISTS homework_student_due_idx ON homework(student_id, due_at);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  homework_id uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  submission_text text NOT NULL DEFAULT '',
  attachment_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewed','needs_revision')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  teacher_feedback text NOT NULL DEFAULT '',
  score numeric(5,2),
  UNIQUE (homework_id, student_id),
  FOREIGN KEY (homework_id, org_id, student_id) REFERENCES homework(id, org_id, student_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS homework_submissions_student_idx ON homework_submissions(student_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  title text NOT NULL,
  score numeric(6,2) NOT NULL CHECK (score >= 0),
  max_score numeric(6,2) NOT NULL CHECK (max_score > 0 AND score <= max_score),
  teacher_note text NOT NULL DEFAULT '',
  tested_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS test_results_student_date_idx ON test_results(student_id, tested_at DESC);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,
  student_id uuid NOT NULL,
  marked_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('present','late','absent','excused')),
  note text NOT NULL DEFAULT '',
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id),
  FOREIGN KEY (class_id, org_id) REFERENCES classes(id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS attendance_student_date_idx ON attendance_records(student_id, marked_at DESC);

CREATE TABLE IF NOT EXISTS learning_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  teacher_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  teacher_observation text NOT NULL DEFAULT '',
  strengths text[] NOT NULL DEFAULT ARRAY[]::text[],
  next_steps text[] NOT NULL DEFAULT ARRAY[]::text[],
  concept_score numeric(6,2),
  concept_max_score numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS learning_updates_student_date_idx ON learning_updates(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS improvement_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  practice_rhythm text NOT NULL DEFAULT '',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS improvement_actions_student_idx ON improvement_actions(student_id, due_at);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  sender_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS messages_student_date_idx ON messages(student_id, created_at);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  invoice_number text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  due_at date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','void','overdue')),
  provider_reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, invoice_number),
  FOREIGN KEY (student_id, org_id) REFERENCES students(id, org_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS invoices_student_date_idx ON invoices(student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject text NOT NULL,
  curriculum text NOT NULL DEFAULT '',
  grade_year text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  resource_url text NOT NULL,
  resource_type text NOT NULL DEFAULT 'link' CHECK (resource_type IN ('link','document','video','interactive')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_org_subject_idx ON learning_materials(org_id, subject, created_at DESC);

CREATE TABLE IF NOT EXISTS enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  grade_year text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','enrolled','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiries_org_created_idx ON enquiries(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_org_date_idx ON audit_events(org_id, created_at DESC);

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION app_role() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.role', true), '') $$;

CREATE OR REPLACE FUNCTION app_is_class_teacher(target_class uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM classes c WHERE c.id = target_class AND c.org_id = app_org_id() AND c.teacher_user_id = app_user_id())
$$;

CREATE OR REPLACE FUNCTION app_can_access_student(target_student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = target_student AND s.org_id = app_org_id()
      AND (
        app_role() = 'admin'
        OR (app_role() = 'student' AND s.linked_user_id = app_user_id())
        OR (app_role() = 'parent' AND EXISTS (
          SELECT 1 FROM student_guardians g WHERE g.student_id = s.id AND g.guardian_user_id = app_user_id()
        ))
        OR (app_role() = 'teacher' AND EXISTS (
          SELECT 1 FROM teacher_assignments a WHERE a.student_id = s.id AND a.teacher_user_id = app_user_id()
        ))
      )
  )
$$;

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY students_select ON students FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(id));
CREATE POLICY students_insert ON students FOR INSERT WITH CHECK (org_id = app_org_id() AND app_role() IN ('parent','admin') AND created_by = app_user_id());
CREATE POLICY students_update ON students FOR UPDATE USING (org_id = app_org_id() AND app_role() IN ('parent','admin') AND app_can_access_student(id)) WITH CHECK (org_id = app_org_id() AND app_can_access_student(id));
CREATE POLICY students_delete ON students FOR DELETE USING (org_id = app_org_id() AND app_role() = 'admin');

ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardians_select ON student_guardians FOR SELECT USING (org_id = app_org_id() AND (guardian_user_id = app_user_id() OR app_can_access_student(student_id)));
CREATE POLICY guardians_insert ON student_guardians FOR INSERT WITH CHECK (org_id = app_org_id() AND ((app_role() = 'parent' AND guardian_user_id = app_user_id()) OR app_role() = 'admin'));
CREATE POLICY guardians_delete ON student_guardians FOR DELETE USING (org_id = app_org_id() AND app_role() = 'admin');

ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_select ON teacher_assignments FOR SELECT USING (org_id = app_org_id() AND (teacher_user_id = app_user_id() OR app_role() = 'admin'));
CREATE POLICY assignments_manage ON teacher_assignments FOR ALL USING (org_id = app_org_id() AND app_role() = 'admin') WITH CHECK (org_id = app_org_id() AND app_role() = 'admin');

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY classes_select ON classes FOR SELECT USING (org_id = app_org_id() AND (app_role() = 'admin' OR teacher_user_id = app_user_id() OR EXISTS (SELECT 1 FROM class_enrollments e WHERE e.class_id = classes.id AND app_can_access_student(e.student_id))));
CREATE POLICY classes_manage ON classes FOR ALL USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND teacher_user_id = app_user_id()))) WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND teacher_user_id = app_user_id())));

ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrollments_select ON class_enrollments FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY enrollments_manage ON class_enrollments FOR ALL USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND app_can_access_student(student_id) AND app_is_class_teacher(class_id)))) WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND app_can_access_student(student_id) AND app_is_class_teacher(class_id))));

ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY homework_select ON homework FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY homework_manage ON homework FOR ALL USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND assigned_by = app_user_id() AND app_can_access_student(student_id)))) WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND assigned_by = app_user_id() AND app_can_access_student(student_id))));

ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY submissions_select ON homework_submissions FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY submissions_student_insert ON homework_submissions FOR INSERT WITH CHECK (org_id = app_org_id() AND app_role() = 'student' AND app_can_access_student(student_id));
CREATE POLICY submissions_student_update ON homework_submissions FOR UPDATE USING (org_id = app_org_id() AND app_role() = 'student' AND app_can_access_student(student_id)) WITH CHECK (org_id = app_org_id() AND app_role() = 'student' AND app_can_access_student(student_id));
CREATE POLICY submissions_teacher_update ON homework_submissions FOR UPDATE USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND app_can_access_student(student_id)))) WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND app_can_access_student(student_id))));

ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY tests_select ON test_results FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY tests_teacher_write ON test_results FOR ALL USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND created_by = app_user_id() AND app_can_access_student(student_id)))) WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND created_by = app_user_id() AND app_can_access_student(student_id))));

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_select ON attendance_records FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY attendance_write ON attendance_records FOR ALL USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND marked_by = app_user_id() AND app_can_access_student(student_id)))) WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND marked_by = app_user_id() AND app_can_access_student(student_id))));

ALTER TABLE learning_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY updates_select ON learning_updates FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY updates_write ON learning_updates FOR ALL USING (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND teacher_user_id = app_user_id() AND app_can_access_student(student_id)))) WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND teacher_user_id = app_user_id() AND app_can_access_student(student_id))));

ALTER TABLE improvement_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY actions_select ON improvement_actions FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY actions_insert ON improvement_actions FOR INSERT WITH CHECK (org_id = app_org_id() AND (app_role() = 'admin' OR (app_role() = 'teacher' AND created_by = app_user_id() AND app_can_access_student(student_id))));
CREATE POLICY actions_update ON improvement_actions FOR UPDATE USING (org_id = app_org_id() AND app_can_access_student(student_id) AND app_role() IN ('parent','student','teacher','admin')) WITH CHECK (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY actions_delete ON improvement_actions FOR DELETE USING (org_id = app_org_id() AND app_role() IN ('teacher','admin') AND app_can_access_student(student_id));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select ON messages FOR SELECT USING (org_id = app_org_id() AND app_can_access_student(student_id));
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (org_id = app_org_id() AND sender_user_id = app_user_id() AND app_can_access_student(student_id));

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_select ON invoices FOR SELECT USING (org_id = app_org_id() AND app_role() IN ('parent','admin') AND app_can_access_student(student_id));
CREATE POLICY invoices_manage ON invoices FOR ALL USING (org_id = app_org_id() AND app_role() = 'admin') WITH CHECK (org_id = app_org_id() AND app_role() = 'admin');

ALTER TABLE learning_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY materials_select ON learning_materials FOR SELECT USING (org_id = app_org_id() AND app_role() IN ('parent','student','teacher','admin'));
CREATE POLICY materials_manage ON learning_materials FOR ALL USING (org_id = app_org_id() AND app_role() IN ('teacher','admin') AND created_by = app_user_id()) WITH CHECK (org_id = app_org_id() AND app_role() IN ('teacher','admin') AND created_by = app_user_id());

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY enquiries_public_insert ON enquiries FOR INSERT WITH CHECK (org_id = app_org_id() AND app_role() = 'public');
CREATE POLICY enquiries_staff_select ON enquiries FOR SELECT USING (org_id = app_org_id() AND app_role() = 'admin');
CREATE POLICY enquiries_staff_update ON enquiries FOR UPDATE USING (org_id = app_org_id() AND app_role() = 'admin') WITH CHECK (org_id = app_org_id() AND app_role() = 'admin');

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_admin_read ON audit_events FOR SELECT USING (org_id = app_org_id() AND app_role() = 'admin');
CREATE POLICY audit_insert ON audit_events FOR INSERT WITH CHECK (org_id = app_org_id() AND actor_user_id = app_user_id());

GRANT USAGE ON SCHEMA public TO srisah_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO srisah_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO srisah_app;
GRANT EXECUTE ON FUNCTION app_user_id(), app_org_id(), app_role(), app_is_class_teacher(uuid), app_can_access_student(uuid) TO srisah_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO srisah_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO srisah_app;
REVOKE ALL PRIVILEGES ON TABLE public.schema_migrations FROM srisah_app;
