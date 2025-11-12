# 🎨 New Toolbar Structure

## 📐 Layout Design

The toolbar now follows a clean 3-line structure at the bottom of the terminal:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│           SCROLLABLE CONTENT AREA               │ ← renderContent() output
│            (Application screens)                │
│                                                 │
├─────────────────────────────────────────────────┤
│ ⏳ Loading messages... / ✓ Success / ✗ Error   │ ← Line 1: Loading/Status
├─────────────────────────────────────────────────┤
│ ❯ [user input cursor here]                     │ ← Line 2: Prompt/Input  
├─────────────────────────────────────────────────┤
│ • quit: Exit • back: Previous • home: Main     │ ← Line 3: Help/Hints
└─────────────────────────────────────────────────┘
```

## 🔧 Implementation Changes

### **Line 1: Loading/Status Area**

- **Loading**: `⏳ Sending one-time passcode...`
- **Success**: `✓ Login successful!` (auto-clears after 2s)
- **Error**: `✗ Verification failed` (auto-clears after 2s)  
- **Idle**: Empty line when nothing is happening

### **Line 2: Prompt/Input Area**

- **Prompt Symbol**: `❯` (consistent across all screens)
- **User Input**: Handled by readline interface
- **Cursor Position**: Positioned after prompt symbol

### **Line 3: Help/Hints Area**

- **Navigation**: `• quit: Exit the CLI • back: Previous screen • home: Main menu`
- **Contextual**: Can be updated per screen if needed
- **Styling**: Dimmed gray text to not distract from main content

## 🎯 Benefits of New Structure

### **1. Visual Clarity**

- Clear separation of concerns
- Predictable information hierarchy  
- Reduced visual clutter

### **2. Consistent UX**

- Loading states always appear in the same location
- Input prompt never moves or gets obscured
- Help information always visible

### **3. Better Accessibility**  

- Screen readers can better navigate the structured layout
- Keyboard navigation is more predictable
- Status information is clearly separated

### **4. Maintainability**

- Simpler codebase with fewer positioning methods
- Consistent rendering logic
- Easier to debug layout issues

## 🔄 API Usage Patterns

### **Basic Screen Flow**

```typescript
// 1. Display content
toolbar.renderContent(screenContent);

// 2. Optional: Show loading
toolbar.showSpinner('Loading data...');
const data = await fetchData();
toolbar.hideSpinner();

// 3. Get user input
const input = await toolbar.promptUser();
```

### **Success/Error Feedback**

```typescript
try {
  await performAction();
  toolbar.showSuccess('Action completed!'); // Line 1, auto-clears
} catch (error) {
  toolbar.showError('Action failed'); // Line 1, auto-clears
}
```

### **Loading States**

```typescript
toolbar.showSpinner('Processing...'); // Shows in Line 1
// ... async work
toolbar.hideSpinner(); // Clears Line 1
```

## 📏 Technical Specifications

### **Line Heights**

- **Line 1**: Dynamic content (spinner/status/empty)
- **Line 2**: Fixed prompt with user input
- **Line 3**: Fixed help text

### **Cursor Management**

- Content renders from top
- Toolbar renders at bottom with 3 reserved lines
- Cursor positioned at Line 2 for input
- Auto-adjusts when terminal resizes

### **Color Scheme**

- **Loading**: Cyan spinner `⏳`
- **Success**: Green checkmark `✓`  
- **Error**: Red X `✗`
- **Prompt**: Default terminal color `❯`
- **Help**: Dimmed gray text

This new structure provides a much cleaner, more predictable user experience! 🚀
