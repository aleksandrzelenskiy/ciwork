export { REGIONS as RUSSIAN_REGIONS, REGION_MAP, REGION_ISO_MAP } from '@/app/constants/regions';
import type { RegionOption as RegionOptionConst } from '@/app/constants/regions';
export type RegionOption = RegionOptionConst;
export type RegionCode = RegionOption['code'];

export function resolveRegionCode(code?: string | null) {
    if (!code) return '';
    if (REGION_MAP.has(code)) return code;
    const match = REGION_ISO_MAP.get(code);
    return match?.code ?? code;
}
