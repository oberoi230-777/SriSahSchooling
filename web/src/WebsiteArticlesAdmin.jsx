import React, { useState } from 'react';
import { BookOpen, Check, Eye, FilePenLine, LoaderCircle, Plus, Send, Trash2, X } from 'lucide-react';
import { api, prettyDate } from './api.js';
import './website-articles-admin.css';

const CATEGORIES = ['meditation', 'healing', 'awareness', 'homeschooling', 'learning'];
const EMPTY_ARTICLE = { title: '', category: 'learning', excerpt: '', content: '', published: false };

export default function WebsiteArticlesAdmin({ records, loading, reload, notify }) {
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');

  const openNew = () => { setError(''); setEditor({ ...EMPTY_ARTICLE }); };
  const openEdit = (article) => { setError(''); setEditor({ ...article }); };
  const closeEditor = () => { if (!saving) { setEditor(null); setError(''); } };

  const save = async (event) => {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError('');
    const body = {
      title: editor.title.trim(),
      category: editor.category,
      excerpt: editor.excerpt.trim(),
      content: editor.content.trim(),
      published: Boolean(editor.published),
    };
    try {
      if (editor.id) await api(`/admin/articles/${editor.id}`, { method: 'PATCH', body });
      else await api('/admin/articles', { method: 'POST', body });
      notify(body.published ? 'Journal article published.' : 'Draft saved securely.');
      setEditor(null);
      reload();
    } catch (requestError) {
      setError(requestError.message || 'The article could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (article) => {
    if (!window.confirm(`Permanently delete “${article.title}”? This cannot be undone.`)) return;
    setDeletingId(article.id);
    setError('');
    try {
      await api(`/admin/articles/${article.id}`, { method: 'DELETE' });
      notify('Article deleted.');
      reload();
    } catch (requestError) {
      setError(requestError.message || 'The article could not be deleted.');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <section className="website-articles-admin" aria-labelledby="website-articles-admin-title">
      <div className="website-articles-admin-intro">
        <div>
          <span className="section-kicker">PUBLIC WEBSITE</span>
          <h2 id="website-articles-admin-title">Journal publishing</h2>
          <p>Write once; published reflections appear on the public journal. Drafts are visible only to organization administrators.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openNew}><Plus size={15} /> New article</button>
      </div>

      {error && !editor && <div className="website-articles-error" role="alert">{error}</div>}
      {editor && <ArticleEditor key={editor.id || 'new'} article={editor} busy={saving} error={error} onCancel={closeEditor} onSave={save} onChange={setEditor} />}

      {loading ? <div className="website-articles-loading" role="status"><LoaderCircle className="spinner" size={19} /> Loading journal content…</div> : records.length === 0 ? (
        <div className="website-articles-empty"><span><BookOpen size={21} /></span><strong>No articles yet</strong><p>Create a draft or publish the first reflection for your community.</p><button className="button button-outline" type="button" onClick={openNew}><Plus size={14} /> Create the first article</button></div>
      ) : (
        <div className="website-article-admin-list">
          {records.map((article) => (
            <article className="website-article-admin-card" key={article.id}>
              <div className="website-article-admin-icon"><BookOpen size={17} /></div>
              <div className="website-article-admin-copy">
                <div className="website-article-admin-meta"><span className={`website-article-status ${article.published ? 'is-published' : 'is-draft'}`}>{article.published ? 'Published' : 'Draft'}</span><span>{article.category}</span><time dateTime={article.updated_at}>{prettyDate(article.updated_at)}</time></div>
                <h3>{article.title}</h3>
                <p>{article.excerpt}</p>
              </div>
              <div className="website-article-admin-actions">
                {article.published && <a className="icon-link" href="/articles" target="_blank" rel="noreferrer" aria-label={`Open public journal to view ${article.title}`} title="Open public journal"><Eye size={15} /></a>}
                <button className="icon-link" type="button" onClick={() => openEdit(article)} aria-label={`Edit ${article.title}`} title="Edit article"><FilePenLine size={15} /></button>
                <button className="icon-link website-article-delete" type="button" onClick={() => remove(article)} disabled={deletingId === article.id} aria-label={`Delete ${article.title}`} title="Delete article">{deletingId === article.id ? <LoaderCircle size={15} className="spinner" /> : <Trash2 size={15} />}</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="website-articles-admin-footnote"><ShieldCheckMark /> Content is stored in your organization database. Publishing, editing, and deletion are recorded in the admin audit log.</div>
    </section>
  );
}

function ShieldCheckMark() {
  return <span className="website-articles-check"><Check size={13} /></span>;
}

function ArticleEditor({ article, busy, error, onCancel, onSave, onChange }) {
  const change = (field) => (event) => onChange({ ...article, [field]: field === 'published' ? event.target.checked : event.target.value });
  return (
    <form className="website-article-editor" onSubmit={onSave}>
      <div className="website-article-editor-heading"><div><span className="section-kicker">{article.id ? 'EDIT JOURNAL ENTRY' : 'NEW JOURNAL ENTRY'}</span><h3>{article.id ? 'Shape this reflection' : 'Write a new reflection'}</h3></div><button className="icon-link" type="button" onClick={onCancel} aria-label="Close editor" disabled={busy}><X size={16} /></button></div>
      <div className="website-article-editor-grid">
        <label>Title<input maxLength="180" value={article.title} onChange={change('title')} required /></label>
        <label>Category<select value={article.category} onChange={change('category')}>{CATEGORIES.map((category) => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></label>
      </div>
      <label>Short summary<textarea rows="2" maxLength="320" value={article.excerpt} onChange={change('excerpt')} required /></label>
      <label>Full article<textarea className="website-article-content-input" rows="11" maxLength="40000" value={article.content} onChange={change('content')} required /></label>
      <label className="website-article-publish-toggle"><input type="checkbox" checked={article.published} onChange={change('published')} /><span><strong>Publish this article</strong><small>When enabled, this article is listed on the public journal. Cached pages may take up to a minute to refresh.</small></span></label>
      {error && <div className="website-articles-error" role="alert">{error}</div>}
      <div className="website-article-editor-actions"><button className="button button-outline" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={15} className="spinner" /> Saving…</> : article.published ? <><Send size={14} /> Save & publish</> : <><Check size={15} /> Save draft</>}</button></div>
    </form>
  );
}
