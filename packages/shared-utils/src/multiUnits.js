export function formatUnitQty(val) {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(num);
}
export function getParentUnitOptionsForList(units, baseUnit, idx) {
    const base = baseUnit?.trim() ? baseUnit.trim().toUpperCase() : 'PCS';
    const options = [base];
    for (let i = 0; i < idx; i++) {
        const prev = units[i];
        if (prev && prev.unitName && prev.unitName.trim()) {
            const name = prev.unitName.trim().toUpperCase();
            if (!options.includes(name)) {
                options.push(name);
            }
        }
    }
    return options;
}
export function recalculateAllUnitFactors(units, baseUnit) {
    const base = baseUnit?.trim().toUpperCase() || 'PCS';
    const factorMap = new Map();
    factorMap.set(base, 1);
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const availableParents = getParentUnitOptionsForList(units, base, i);
        if (!u.parentUnitName || !availableParents.includes(u.parentUnitName.toUpperCase())) {
            u.parentUnitName = availableParents[availableParents.length - 1] || base;
        }
        const parentName = u.parentUnitName.trim().toUpperCase();
        const parentFactor = factorMap.get(parentName) ?? 1;
        const num = Number(u.displayFactor) || 0;
        if (num <= 0) {
            u.conversionFactor = 0;
        }
        else if (u.mode === 'multiple') {
            u.conversionFactor = Number((parentFactor * num).toFixed(6));
        }
        else {
            // Fraction (default): Per 1 Parent = num Unit Baru -> konversi = parentFactor / num
            u.conversionFactor = Number((parentFactor / num).toFixed(6));
        }
        if (u.unitName && u.unitName.trim() && u.conversionFactor > 0) {
            factorMap.set(u.unitName.trim().toUpperCase(), u.conversionFactor);
        }
    }
}
export function getEquivalentTotalStock(u, currentStock) {
    const totalStock = Number(currentStock) || 0;
    if (totalStock <= 0 || !u.conversionFactor || u.conversionFactor <= 0)
        return '0';
    const eq = totalStock / u.conversionFactor;
    const rounded = Math.abs(eq - Math.round(eq)) < 0.05 ? Math.round(eq) : Math.round(eq * 100) / 100;
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(rounded);
}
export function getProportionalSellPrice(u, baseSellPrice) {
    const baseSell = Number(baseSellPrice) || 0;
    if (baseSell <= 0 || !u.conversionFactor || u.conversionFactor <= 0)
        return 0;
    return Math.round(baseSell * u.conversionFactor);
}
export function isUnitFactorInvalid(u) {
    const hasFactor = Boolean(u.displayFactor && Number(u.displayFactor) > 0);
    const hasName = Boolean(u.unitName && u.unitName.trim().length > 0);
    const hasPrice = Boolean(u.sellPrice && Number(u.sellPrice) > 0);
    return (hasName || hasPrice) && !hasFactor;
}
export function isUnitNameInvalid(u) {
    const hasFactor = Boolean(u.displayFactor && Number(u.displayFactor) > 0);
    const hasName = Boolean(u.unitName && u.unitName.trim().length > 0);
    const hasPrice = Boolean(u.sellPrice && Number(u.sellPrice) > 0);
    return (hasFactor || hasPrice) && !hasName;
}
export function isUnitPriceInvalid(u) {
    const hasFactor = Boolean(u.displayFactor && Number(u.displayFactor) > 0);
    const hasName = Boolean(u.unitName && u.unitName.trim().length > 0);
    const hasPrice = Boolean(u.sellPrice && Number(u.sellPrice) > 0);
    return (hasFactor || hasName) && !hasPrice;
}
export function isUnitRowPartiallyFilled(u) {
    return isUnitFactorInvalid(u) || isUnitNameInvalid(u) || isUnitPriceInvalid(u);
}
