# Integration Guide - Quick Start Improvements

This guide shows how to integrate the new improvements into your existing codebase.

## 1. Replace Console Logs with Logger

### Before:
```typescript
console.log("WebSocket connected");
console.error("Failed to connect", error);
```

### After:
```typescript
import { logger } from '@/lib/logger';

logger.info("WebSocket connected", {}, 'websocket');
logger.error("Failed to connect", error, 'websocket');
```

### Steps:
1. Import logger in files that use console.log/error/warn
2. Replace console.log → logger.info
3. Replace console.error → logger.error
4. Replace console.warn → logger.warn
5. Add context string as third parameter (e.g., 'websocket', 'api', 'auth')

## 2. Replace API Client

### Before:
```typescript
import apiClient from '@/lib/api';
```

### After:
```typescript
import apiClient from '@/lib/api-client';
// OR keep using '@/lib/api' if you update it to export the new client
```

### Steps:
1. Update `src/lib/api.ts` to export the new enhanced client:
   ```typescript
   export { apiClient as default } from './api-client';
   ```
2. Or directly import from `api-client.ts` in new code
3. The new client has automatic retry logic and better error handling

## 3. Add Error Boundaries

### Wrap Main App Sections:

```typescript
// In src/app/layout.tsx or main page components
import { ErrorBoundary } from '@/components/error-boundary';

export default function Layout({ children }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
```

### Wrap Specific Components:

```typescript
import { ErrorBoundary } from '@/components/error-boundary';

function MapPage() {
  return (
    <ErrorBoundary fallback={<MapErrorFallback />}>
      <MapComponent />
    </ErrorBoundary>
  );
}
```

## 4. Integrate Offline Queue

### For Critical API Calls:

```typescript
import { offlineQueue } from '@/lib/offline-queue';

// When offline, queue the request
if (!navigator.onLine) {
  await offlineQueue.enqueue({
    method: 'POST',
    url: '/devices/123/command',
    data: { command: 'engineStop' },
  });
} else {
  // Normal API call
  await apiClient.post('/devices/123/command', { command: 'engineStop' });
}
```

### Show Queue Status to Users:

```typescript
import { offlineQueue } from '@/lib/offline-queue';
import { useEffect, useState } from 'react';

function SyncStatus() {
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const updateStatus = () => {
      const stats = offlineQueue.getStats();
      setQueueSize(stats.total);
    };

    updateStatus();
    const unsubscribe = offlineQueue.onSync(updateStatus);
    return unsubscribe;
  }, []);

  if (queueSize > 0) {
    return <div>{queueSize} requests pending sync</div>;
  }
  return null;
}
```

## 5. Priority Integration Order

### Phase 1: Critical (Do First)
1. ✅ Add Error Boundaries to main app sections
2. ✅ Replace API client (update api.ts to use new client)
3. ✅ Add logger to critical paths (WebSocket, Auth, API)

### Phase 2: Important
4. ✅ Replace all console.log with logger
5. ✅ Add offline queue for critical operations
6. ✅ Add retry logic to existing API calls

### Phase 3: Enhancements
7. Add React.memo to expensive components
8. Implement code splitting
9. Add monitoring/analytics

## 6. Example: Updated WebSocket Context

```typescript
// Partial example showing logger integration
import { logger } from '@/lib/logger';

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  // ... existing code ...

  const connectWebSocket = async () => {
    try {
      logger.info('Attempting WebSocket connection', {}, 'websocket');
      // ... connection logic ...
      logger.info('WebSocket connected successfully', {}, 'websocket');
    } catch (error) {
      logger.error('WebSocket connection failed', error, 'websocket');
    }
  };

  // ... rest of code ...
};
```

## 7. Example: Updated API Calls

```typescript
// Before
try {
  const response = await apiClient.post('/devices', data);
  console.log('Device created');
} catch (error) {
  console.error('Failed to create device', error);
}

// After
import { logger } from '@/lib/logger';

try {
  const response = await apiClient.post('/devices', data);
  logger.info('Device created successfully', { deviceId: response.data.id }, 'devices');
} catch (error) {
  logger.error('Failed to create device', error, 'devices');
  // Error is already handled by api-client with retry logic
}
```

## 8. Testing the Changes

### Test Error Boundary:
1. Intentionally throw an error in a component
2. Verify error boundary catches it
3. Verify error is logged
4. Test "Try Again" and "Reload" buttons

### Test Logger:
1. Check browser console in development (should see logs)
2. Check network tab for `/api/logs` calls in production
3. Verify logs include context and timestamps

### Test API Client:
1. Disconnect network temporarily
2. Make API call
3. Verify retry logic works
4. Check error handling

### Test Offline Queue:
1. Go offline
2. Make API calls
3. Verify requests are queued
4. Go online
5. Verify queue syncs automatically

## 9. Migration Checklist

- [ ] Install new dependencies (if any)
- [ ] Add ErrorBoundary to main layout
- [ ] Update api.ts to use new api-client
- [ ] Replace console.log in critical files:
  - [ ] websocket-context.tsx
  - [ ] auth-context.tsx
  - [ ] api.ts
  - [ ] tracking/page.tsx
- [ ] Add offline queue to critical operations
- [ ] Test all changes
- [ ] Update documentation

## 10. Rollback Plan

If issues occur:
1. Keep old api.ts as backup
2. Error boundaries are non-breaking (they only catch errors)
3. Logger can be disabled by setting NODE_ENV
4. Offline queue can be disabled by not calling enqueue

## Notes

- All new utilities are backward compatible
- Existing code will continue to work
- Changes can be integrated gradually
- Test each change before moving to next

