import { useState, useCallback } from 'react';
import { toast } from 'sonner';

/**
 * API 调用配置
 */
interface ApiCallOptions<T> {
  /** 成功时的提示消息 */
  successMessage?: string;
  /** 错误时的提示消息(如果不提供,使用服务器返回的错误) */
  errorMessage?: string;
  /** 成功后的回调 */
  onSuccess?: (data: T) => void;
  /** 错误后的回调 */
  onError?: (error: Error) => void;
  /** 完成后的回调(无论成功或失败) */
  onFinally?: () => void;
  /** 是否显示成功提示 */
  showSuccessToast?: boolean;
  /** 是否显示错误提示 */
  showErrorToast?: boolean;
}

/**
 * API 调用状态
 */
interface ApiCallState {
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
}

/**
 * 统一的 API 调用 Hook
 * 
 * @example
 * ```tsx
 * const { execute, loading, error } = useApiCall();
 * 
 * const handleSubmit = async () => {
 *   await execute(
 *     async () => {
 *       const res = await fetch('/api/endpoint', { method: 'POST' });
 *       if (!res.ok) throw new Error('Failed');
 *       return res.json();
 *     },
 *     {
 *       successMessage: '操作成功',
 *       onSuccess: (data) => console.log(data)
 *     }
 *   );
 * };
 * ```
 */
export function useApiCall<T = unknown>() {
  const [state, setState] = useState<ApiCallState>({
    loading: false,
    error: null,
  });

  /**
   * 执行 API 调用
   * @param apiCall API 调用函数
   * @param options 配置选项
   * @returns API 调用结果
   */
  const execute = useCallback(
    async (
      apiCall: () => Promise<T>,
      options: ApiCallOptions<T> = {}
    ): Promise<T | null> => {
      const {
        successMessage,
        errorMessage,
        onSuccess,
        onError,
        onFinally,
        showSuccessToast = true,
        showErrorToast = true,
      } = options;

      setState({ loading: true, error: null });

      try {
        const result = await apiCall();

        // 成功提示
        if (showSuccessToast && successMessage) {
          toast.success(successMessage);
        }

        // 成功回调
        if (onSuccess) {
          onSuccess(result);
        }

        setState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        setState({ loading: false, error });

        // 错误提示
        if (showErrorToast) {
          const message = errorMessage || error.message || '操作失败';
          toast.error(message);
        }

        // 错误回调
        if (onError) {
          onError(error);
        }

        return null;
      } finally {
        // 完成回调
        if (onFinally) {
          onFinally();
        }
      }
    },
    []
  );

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({ loading: false, error: null });
  }, []);

  return {
    execute,
    reset,
    loading: state.loading,
    error: state.error,
  };
}

/**
 * 用于表单提交的 API 调用 Hook
 * 自动处理表单提交事件
 */
export function useFormSubmit<T = unknown>() {
  const { execute, loading, error, reset } = useApiCall<T>();

  const handleSubmit = useCallback(
    (
      apiCall: () => Promise<T>,
      options: ApiCallOptions<T> = {}
    ) => {
      return async (e?: React.FormEvent) => {
        if (e) {
          e.preventDefault();
        }
        return execute(apiCall, options);
      };
    },
    [execute]
  );

  return {
    handleSubmit,
    loading,
    error,
    reset,
  };
}
