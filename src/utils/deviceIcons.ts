
interface Device {
    category?: string | null;
    name: string;
}

export function getDeviceCategory(device: Device): string {
    if (device.category) {
        return device.category;
    }
    const name = device.name.toLowerCase();
    if (name.includes('bike') || name.includes('motorcycle')) return 'bike';
    if (name.includes('car')) return 'car';
    if (name.includes('truck')) return 'truck';
    if (name.includes('bus')) return 'bus';
    if (name.includes('van')) return 'van';
    if (name.includes('boat') || name.includes('ship')) return 'boat';
    if (name.includes('plane') || name.includes('aircraft')) return 'aircraft';
    if (name.includes('drone')) return 'drone';
    return 'car'; // Default
}
