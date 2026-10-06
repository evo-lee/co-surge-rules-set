// Minimal YAML serializer for generated Clash configs.
function yamlScalar(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value ?? ''));
}

function yamlValue(value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    return value.map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return `${pad}- ${yamlScalar(item)}`;
      }

      const entries = Object.entries(item);
      return entries.map(([key, val], index) => {
        const prefix = index === 0 ? `${pad}- ${key}` : `${pad}  ${key}`;
        if (val && typeof val === 'object') {
          return `${prefix}:\n${yamlValue(val, indent + 4)}`;
        }
        return `${prefix}: ${yamlScalar(val)}`;
      }).join('\n');
    }).join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, val]) => {
        if (val && typeof val === 'object') {
          return `${pad}${key}:\n${yamlValue(val, indent + 2)}`;
        }
        return `${pad}${key}: ${yamlScalar(val)}`;
      })
      .join('\n');
  }
  return yamlScalar(value);
}

function toYaml(data) {
  return yamlValue(data) + '\n';
}

module.exports = { toYaml };
