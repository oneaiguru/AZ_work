import { reactive, toRefs } from "vue";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const state = reactive({
  toasts: [] as Toast[],
  counter: 0
});

function push(message: string, type: ToastType) {
  const id = state.counter++;
  state.toasts.push({ id, message, type });
  setTimeout(() => dismiss(id), 4000);
}

function dismiss(id: number) {
  const index = state.toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) {
    state.toasts.splice(index, 1);
  }
}

export function useNotifications() {
  const notifySuccess = (message: string) => push(message, "success");
  const notifyError = (message: string) => push(message, "error");
  return {
    ...toRefs(state),
    notifySuccess,
    notifyError,
    dismiss
  };
}
