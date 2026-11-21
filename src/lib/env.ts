/** Set when building the single-file version hosted as a claude.ai artifact,
 *  where downloads, printing and deep-linking are not available. */
export const IS_ARTIFACT = import.meta.env.VITE_TARGET === 'artifact';
export const CAN_DOWNLOAD = !IS_ARTIFACT;
