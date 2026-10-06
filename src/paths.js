// Published artifact layout (relative to the release branch root).
const { RELEASE_BASE } = require('./definition');

const SET_FILE = {
  surge: id => `surge/${id}.list`,
  clash: id => `clash/${id}.txt`,
  qx: id => `qx/${id}.list`
};

const RULES_FILE = {
  surge: 'surge/rules.conf',
  shadowrocket: 'shadowrocket/rules.conf',
  clash: 'clash/rules.yaml',
  qx: 'qx/rules.conf'
};

function setPath(client, id) {
  return SET_FILE[client](id);
}

function setUrl(client, id, base = RELEASE_BASE) {
  return `${base}/${setPath(client, id)}`;
}

module.exports = { SET_FILE, RULES_FILE, setPath, setUrl };
