/** Safe, local-only diagnostics for the Founder Liepin search call. */

export function createLiepinSearchDiagnostics({ tokenAvailable = false, credentialSource = "liepin-cli config" } = {}) {
  return {
    profileSearchCriteriaGenerated: false,
    liepinCliFound: null,
    tokenAvailable: Boolean(tokenAvailable),
    credentialSource,
    liepinCliExitStatus: null,
    responseParse: 'not_attempted',
    sanitizedErrorMessage: null,
  };
}

/** Never return CLI stderr/stdout: either can contain sensitive provider data. */
export function sanitizeLiepinSearchError(error) {
  if (/\b401\b|unauthorized/iu.test(String(error?.message ?? ' '))) return 'Liepin credential error (401)';
  if (error?.code === 'ENOENT') return '未找到 liepin-cli。';
  if (error?.killed || error?.signal === 'SIGTERM') return 'liepin-cli 搜索超时。';
  if (typeof error?.code === 'number') return `liepin-cli 以状态 ${error.code} 退出。`;
  return 'liepin-cli 未能完成搜索。';
}
