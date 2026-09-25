/**
 * jira provider — SKELETON. Not wired to a transport yet.
 *
 * Everything that is *procedure* is already written here: the generic <-> Jira
 * field and status translation. What's missing is only the transport — one
 * function, `call()`, that actually reaches Jira. Fill it in, set
 * sdlc.config.json -> tracker.provider = "jira", and the whole flow runs
 * against Jira with no other edit anywhere.
 *
 * Two transports are sketched:
 *   "mcp" — an Atlassian MCP server is connected; the agent calls its tools.
 *           A node script can't call MCP tools, so in this mode the provider
 *           returns a { needsAgent: true, request } envelope and the SKILL
 *           performs the call. See rules/tracker.md.
 *   "cli" — plain REST over fetch with JIRA_EMAIL + JIRA_API_TOKEN from env.
 */

const rule = (m) => Object.assign(new Error(m), { code: 'RULE' });

function jcfg(cfg) {
  const j = cfg.tracker?.jira ?? {};
  if (!j.baseUrl || !j.projectKey) {
    throw rule('tracker.jira.baseUrl and tracker.jira.projectKey must be set in .claude/sdlc.config.json');
  }
  return j;
}

/* ------------------------------------------------------------------ *
 * Translation — generic vocabulary <-> Jira. This part is done.
 * ------------------------------------------------------------------ */

/** generic status -> Jira status name */
export function toJiraStatus(cfg, status) {
  const map = jcfg(cfg).statusMap ?? {};
  const name = map[status];
  if (!name) throw rule(`no tracker.jira.statusMap entry for status "${status}"`);
  return name;
}

/** Jira status name -> generic status, for a given item type */
export function fromJiraStatus(cfg, type, jiraName) {
  const map = jcfg(cfg).statusMap ?? {};
  const allowed = cfg.statuses?.[type] ?? [];
  const hit = Object.entries(map).find(([generic, jira]) => jira === jiraName && allowed.includes(generic));
  return hit ? hit[0] : allowed[0];
}

/** Jira issue -> the generic item shape every provider must return */
export function fromJiraIssue(cfg, issue, type) {
  const fm = jcfg(cfg).fieldMap ?? {};
  const f = issue.fields ?? {};
  return {
    id: issue.key,
    type,
    title: f.summary ?? '',
    status: fromJiraStatus(cfg, type, f.status?.name),
    parent: f[fm.parent ?? 'parent']?.key ?? null,
    screens: splitList(f[fm.screen]),
    prototype: f[fm.prototype] ?? null,
    approvedVersion: f[fm.prototypeVersion] ?? null,
    created: (f.created ?? '').slice(0, 10),
    updated: (f.updated ?? '').slice(0, 10),
    body: f.description ?? '',
    extra: {},
  };
}

/** the generic item shape -> Jira fields payload */
export function toJiraFields(cfg, item) {
  const j = jcfg(cfg);
  const fm = j.fieldMap ?? {};
  const fields = {
    project: { key: j.projectKey },
    issuetype: { name: j.issueType?.[item.type] ?? 'Task' },
    summary: item.title,
    description: item.body ?? '',
  };
  if (item.parent) fields[fm.parent ?? 'parent'] = { key: item.parent };
  if (fm.screen && item.screens?.length) fields[fm.screen] = item.screens.join(', ');
  if (fm.prototypeVersion && item.approvedVersion) fields[fm.prototypeVersion] = item.approvedVersion;
  return fields;
}

const splitList = (v) => (typeof v === 'string' ? v.split(/[,\s]+/).filter(Boolean) : Array.isArray(v) ? v : []);

/* ------------------------------------------------------------------ *
 * Transport — TODO: this is the only part you have to write.
 * ------------------------------------------------------------------ */

async function call(cfg, { method, path, body }) {
  const j = jcfg(cfg);
  if (j.transport === 'mcp') {
    // A node script cannot invoke an MCP tool. Hand the request back up so the
    // calling SKILL makes it with the Atlassian MCP tools and feeds the result
    // through the translation functions above.
    throw rule(`transport "mcp": the skill must make this call itself — ${method} ${path}`);
  }
  // transport "cli": REST.
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!email || !token) throw rule('set JIRA_EMAIL and JIRA_API_TOKEN in the environment');
  const res = await fetch(`${j.baseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64'),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Jira ${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/* ------------------------------------------------------------------ *
 * Verbs — the same seven every provider exports.
 * ------------------------------------------------------------------ */

export async function list(cfg, args) {
  const j = jcfg(cfg);
  const clauses = [`project = "${j.projectKey}"`];
  if (args.type) clauses.push(`issuetype = "${j.issueType?.[args.type] ?? 'Task'}"`);
  if (args.status) clauses.push(`status = "${toJiraStatus(cfg, args.status)}"`);
  if (args.parent) clauses.push(`parent = "${args.parent}"`);
  const data = await call(cfg, { method: 'POST', path: '/rest/api/3/search', body: { jql: clauses.join(' AND '), maxResults: 200 } });
  const items = (data.issues ?? []).map((i) => fromJiraIssue(cfg, i, args.type ?? 'story'));
  return { count: items.length, items };
}

export async function get(cfg, args) {
  const key = args._[0];
  if (!key) throw new Error('get needs an issue key');
  const issue = await call(cfg, { method: 'GET', path: `/rest/api/3/issue/${key}` });
  const type = issue.fields?.issuetype?.name === jcfg(cfg).issueType?.requirement ? 'requirement' : 'story';
  return { item: fromJiraIssue(cfg, issue, type) };
}

export async function create(cfg, args) {
  const item = {
    type: args.type, title: args.title, parent: args.parent ?? null,
    screens: args.set.screens ? args.set.screens.split(/[,\s]+/) : [],
    approvedVersion: args.set.approvedVersion ?? null,
    body: args['body-file'] ? (await import('node:fs')).readFileSync(args['body-file'], 'utf8') : '',
  };
  const created = await call(cfg, { method: 'POST', path: '/rest/api/3/issue', body: { fields: toJiraFields(cfg, item) } });
  return { id: created.key, item: { ...item, id: created.key } };
}

export async function set(cfg, args) {
  const key = args._[0];
  if (args.status) {
    // TODO: Jira moves status via transitions, not field writes. Look the
    // transition up by target status name, then POST it.
    const target = toJiraStatus(cfg, args.status);
    const { transitions } = await call(cfg, { method: 'GET', path: `/rest/api/3/issue/${key}/transitions` });
    const t = transitions.find((x) => x.to?.name === target);
    if (!t) throw rule(`no Jira transition from the current status to "${target}" for ${key}`);
    await call(cfg, { method: 'POST', path: `/rest/api/3/issue/${key}/transitions`, body: { transition: { id: t.id } } });
  }
  const fm = jcfg(cfg).fieldMap ?? {};
  const fields = {};
  for (const [k, v] of Object.entries(args.set)) if (fm[k]) fields[fm[k]] = v;
  if (Object.keys(fields).length) await call(cfg, { method: 'PUT', path: `/rest/api/3/issue/${key}`, body: { fields } });
  return await get(cfg, args);
}

export async function setBody(cfg, args) {
  const key = args._[0];
  const text = (await import('node:fs')).readFileSync(args.file, 'utf8');
  await call(cfg, { method: 'PUT', path: `/rest/api/3/issue/${key}`, body: { fields: { description: text } } });
  return { id: key };
}

export async function comment(cfg, args) {
  const key = args._[0];
  const text = args._.slice(1).join(' ');
  await call(cfg, { method: 'POST', path: `/rest/api/3/issue/${key}/comment`, body: { body: text } });
  return { id: key };
}

export async function next(cfg, args) {
  const { items } = await list(cfg, { ...args, type: args.type ?? 'story', status: 'ready' });
  return { item: items[0] ?? null };
}
