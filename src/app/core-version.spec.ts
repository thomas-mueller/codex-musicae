import { describe, expect, it } from 'vitest';

import { parseGitDescribe } from './core/version/version';

describe('parseGitDescribe', () => {
  it('PIP-005 parses a tagged version with commits since the tag', () => {
    expect(parseGitDescribe('v0.5.0-12-g3f2a9c1')).toEqual({
      raw: 'v0.5.0-12-g3f2a9c1', tag: 'v0.5.0', commitsSinceTag: 12, sha: '3f2a9c1', dirty: false,
    });
  });

  it('PIP-005 parses an exact tag checkout', () => {
    expect(parseGitDescribe('v0.5.0-0-g3f2a9c1')).toEqual({
      raw: 'v0.5.0-0-g3f2a9c1', tag: 'v0.5.0', commitsSinceTag: 0, sha: '3f2a9c1', dirty: false,
    });
  });

  it('PIP-005 parses a dirty tagged checkout', () => {
    expect(parseGitDescribe('v0.5.0-12-g3f2a9c1-dirty')).toEqual({
      raw: 'v0.5.0-12-g3f2a9c1-dirty', tag: 'v0.5.0', commitsSinceTag: 12, sha: '3f2a9c1', dirty: true,
    });
  });

  it('PIP-005 parses an untagged commit hash', () => {
    expect(parseGitDescribe('3f2a9c1')).toEqual({
      raw: '3f2a9c1', tag: null, commitsSinceTag: null, sha: '3f2a9c1', dirty: false,
    });
  });

  it('PIP-005 parses an empty version safely', () => {
    expect(parseGitDescribe('')).toEqual({
      raw: '', tag: null, commitsSinceTag: null, sha: null, dirty: false,
    });
  });

  it('PIP-005 rejects malformed version text without throwing', () => {
    expect(parseGitDescribe('not-a-git-version')).toEqual({
      raw: 'not-a-git-version', tag: null, commitsSinceTag: null, sha: null, dirty: false,
    });
  });
});
