export function createPageUrl(pageName: string) {
    // Converte CamelCase/PascalCase para kebab-case
    const kebab = pageName
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/ /g, '-')
        .toLowerCase();
    return '/' + kebab;
}