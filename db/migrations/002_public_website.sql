-- Public website content and contact submissions share the school organization's access model.
-- Contact records are admissions enquiries or general website messages; the admin portal
-- remains the only authenticated surface that can read and triage them.

ALTER TABLE enquiries
  ADD COLUMN enquiry_type text NOT NULL DEFAULT 'admission'
    CHECK (enquiry_type IN ('admission', 'contact')),
  ADD COLUMN phone text NOT NULL DEFAULT '',
  ADD COLUMN interest text NOT NULL DEFAULT '';

ALTER TABLE enquiries ALTER COLUMN country DROP NOT NULL;
ALTER TABLE enquiries ALTER COLUMN grade_year DROP NOT NULL;
ALTER TABLE enquiries ALTER COLUMN subject DROP NOT NULL;

CREATE TABLE website_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 180),
  category text NOT NULL CHECK (category IN ('meditation', 'healing', 'awareness', 'homeschooling', 'learning')),
  excerpt text NOT NULL CHECK (length(excerpt) BETWEEN 1 AND 320),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 40000),
  author_name text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, org_id)
);
CREATE INDEX website_articles_public_idx
  ON website_articles(org_id, published, updated_at DESC);

ALTER TABLE website_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY website_articles_select ON website_articles FOR SELECT
  USING (
    org_id = app_org_id()
    AND (app_role() = 'admin' OR (app_role() = 'public' AND published = true))
  );
CREATE POLICY website_articles_insert ON website_articles FOR INSERT
  WITH CHECK (org_id = app_org_id() AND app_role() = 'admin' AND created_by = app_user_id());
CREATE POLICY website_articles_update ON website_articles FOR UPDATE
  USING (org_id = app_org_id() AND app_role() = 'admin')
  WITH CHECK (org_id = app_org_id() AND app_role() = 'admin');
CREATE POLICY website_articles_delete ON website_articles FOR DELETE
  USING (org_id = app_org_id() AND app_role() = 'admin');

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE website_articles TO srisah_app;
