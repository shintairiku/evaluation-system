# Enhanced Toast Notification System

## Overview

The toast notification system has been enhanced with improved stacking behavior, close buttons, and better visual design. This document explains the new features and how to use them effectively.

## Key Features

### ✅ **Proper Stacking Behavior**
- **New toasts appear at the top** (most recent first)
- **Older toasts move down** gradually with smooth animations
- **Maximum 4 visible toasts** at once
- **Auto-dismiss after 4 seconds** (increased from previous duration)
- **Hover to pause** - all toasts expand and pause when hovering over the stack

### ✅ **Close Buttons**
- **Individual close button** on each toast (top-right corner)
- **Hover effects** - button becomes more visible on hover
- **Manual dismissal** - users can close toasts before auto-dismiss

### ✅ **Fixed Message Length**
- **Minimum width: 320px** (longer than before)
- **Maximum width: 480px** for very long messages
- **Consistent sizing** across all toasts
- **Proper text wrapping** for long content

### ✅ **Enhanced Visual Design**
- **Gradient backgrounds** for different toast types
- **Backdrop blur effect** for modern glass-morphism look
- **Smooth animations** for enter/exit transitions
- **Responsive scaling** in stacked view

## Usage Examples

### Basic Toast Usage

```typescript
import { toast } from 'sonner';

// Success toast
toast.success('操作が完了しました');

// Error toast
toast.error('操作に失敗しました');

// Info toast
toast.info('新しい情報があります');

// Warning toast
toast.warning('注意が必要です');
```

### Toast with Description

```typescript
toast.success('プロフィールを更新しました', {
  description: '変更内容が正常に保存されました。'
});
```

### Toast with Action Button

```typescript
toast.success('ファイルが削除されました', {
  description: 'この操作を取り消すことができます。',
  action: {
    label: '元に戻す',
    onClick: () => {
      // Undo logic here
      toast.info('削除を取り消しました');
    }
  }
});
```

### Custom Duration

```typescript
toast.success('重要なお知らせ', {
  duration: 10000, // 10 seconds
  description: 'この通知は10秒間表示されます。'
});
```

## Configuration

### Global Toaster Settings

Located in `/src/components/ui/sonner.tsx`:

```typescript
<Sonner
  // Position
  position="top-right"
  
  // Stacking
  visibleToasts={4}      // Maximum visible toasts
  expand={true}          // Allow expanding on hover
  gap={8}               // Gap between toasts
  offset={16}           // Offset from screen edge
  
  // Features
  richColors={true}     // Enable rich color scheme
  closeButton={true}    // Show close buttons
  
  // Default options for all toasts
  toastOptions={{
    duration: 4000,      // 4 seconds (longer than before)
    style: {
      minWidth: '320px',  // Fixed minimum width
      maxWidth: '480px',  // Maximum width
    }
  }}
/>
```

### CSS Customization

Toast styles are defined in `/src/app/globals.css` under the `@layer components` section:

- **Stacking animations** - smooth scale and translation effects
- **Color themes** - gradient backgrounds for each toast type
- **Close button styling** - positioned and styled close buttons
- **Responsive design** - proper scaling on different screen sizes

## Toast Types and Colors

### Success Toasts
- **Color**: Green gradient (`bg-green-500/90` to `bg-green-600/90`)
- **Use case**: Successful operations, confirmations
- **Icon**: Automatically added by Sonner

### Error Toasts
- **Color**: Red gradient (`bg-red-500/90` to `bg-red-600/90`)
- **Use case**: Failed operations, validation errors
- **Icon**: Automatically added by Sonner

### Info Toasts
- **Color**: Blue gradient (`bg-blue-500/90` to `bg-blue-600/90`)
- **Use case**: Informational messages, status updates
- **Icon**: Automatically added by Sonner

### Warning Toasts
- **Color**: Yellow gradient (`bg-yellow-500/90` to `bg-yellow-600/90`)
- **Use case**: Cautionary messages, important notices
- **Icon**: Automatically added by Sonner

## Animation Behavior

### Stacking Animation
```css
/* First toast (newest) - full size and opacity */
[data-sonner-toast][data-index="0"] {
  transform: scale(1);
  opacity: 1;
}

/* Second toast - slightly smaller */
[data-sonner-toast][data-index="1"] {
  transform: translateY(-4px) scale(0.98);
  opacity: 0.9;
}

/* Third toast - smaller */
[data-sonner-toast][data-index="2"] {
  transform: translateY(-8px) scale(0.96);
  opacity: 0.8;
}

/* Fourth toast - smallest visible */
[data-sonner-toast][data-index="3"] {
  transform: translateY(-12px) scale(0.94);
  opacity: 0.7;
}
```

### Hover Expansion
When hovering over the toast stack, all toasts expand to full size:

```css
[data-sonner-toaster]:hover [data-sonner-toast] {
  transform: scale(1) !important;
  opacity: 1 !important;
}
```

### Enter/Exit Animations
- **Enter**: Slide in from right with scale effect
- **Exit**: Slide out to right with scale effect
- **Duration**: 300ms enter, 200ms exit
- **Easing**: Cubic bezier curves for smooth motion

## Best Practices

### 1. **Message Length**
```typescript
// ✅ Good: Concise but informative
toast.success('プロフィールを更新しました');

// ✅ Good: With description for details
toast.success('保存完了', {
  description: 'プロフィール情報が正常に更新されました。'
});

// ❌ Avoid: Too verbose in main message
toast.success('ユーザープロフィール情報の更新処理が正常に完了し、データベースに保存されました');
```

### 2. **Toast Types**
```typescript
// ✅ Good: Appropriate type for context
toast.success('データを保存しました');        // For successful actions
toast.error('保存に失敗しました');             // For errors
toast.info('新しいバージョンが利用可能です');    // For information
toast.warning('未保存の変更があります');        // For warnings

// ❌ Avoid: Wrong type for context
toast.error('データを保存しました');           // Success shown as error
```

### 3. **Action Buttons**
```typescript
// ✅ Good: Meaningful actions
toast.success('ファイルを削除しました', {
  action: {
    label: '元に戻す',
    onClick: () => restoreFile()
  }
});

// ✅ Good: Navigation actions
toast.info('新しいメッセージがあります', {
  action: {
    label: '確認',
    onClick: () => router.push('/messages')
  }
});

// ❌ Avoid: Redundant actions
toast.success('保存しました', {
  action: {
    label: 'OK',      // Unnecessary - toast will auto-dismiss
    onClick: () => {} // No meaningful action
  }
});
```

### 4. **Frequency Management**
```typescript
// ✅ Good: Debounced notifications
const debouncedToast = debounce((message: string) => {
  toast.success(message);
}, 1000);

// ❌ Avoid: Too many rapid notifications
function rapidSave() {
  toast.success('保存中...');  // Avoid triggering on every keystroke
}
```

## Testing the Toast System

Use the `ToastDemo` component to test all toast features:

```typescript
import { ToastDemo } from '@/components/ui/toast-demo';

// Add to any page for testing
function TestPage() {
  return (
    <div className="p-8">
      <ToastDemo />
    </div>
  );
}
```

### Test Checklist
- [ ] New toasts appear at the top
- [ ] Older toasts move down with animation
- [ ] Maximum 4 toasts visible at once
- [ ] Each toast has a close button in the top-right
- [ ] Hover expands all toasts
- [ ] Auto-dismiss after 4 seconds
- [ ] Toasts are 320px-480px wide
- [ ] Smooth enter/exit animations
- [ ] Different colors for different types
- [ ] Action buttons work correctly

## Integration with Optimistic Updates

The enhanced toast system works seamlessly with the optimistic update system:

```typescript
import { useOptimisticUpdate } from '@/hooks/useOptimisticUpdate';

const optimisticUpdate = useOptimisticUpdate(state, {
  optimisticUpdate: (current) => ({ ...current, ...updates }),
  asyncOperation: () => updateData(updates),
  successMessage: 'データを更新しました',  // Will use enhanced styling
  errorMessage: '更新に失敗しました',       // Will use enhanced styling
  enableToasts: true
});
```

## Performance Considerations

- **CSS animations** use GPU acceleration for smooth performance
- **Maximum toast limit** prevents memory issues from too many notifications
- **Auto-cleanup** removes toasts from DOM after dismissal
- **Efficient re-renders** through proper CSS targeting

## Browser Support

- **Modern browsers** - Full support with all animations
- **Older browsers** - Graceful degradation without advanced animations
- **Mobile devices** - Touch-friendly close buttons and responsive sizing

---

This enhanced toast system provides a modern, user-friendly notification experience that integrates perfectly with the optimistic update system and follows current UI/UX best practices.