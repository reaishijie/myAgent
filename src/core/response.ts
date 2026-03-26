export interface IResponse<T = any> {
    code: number | string;
    success: boolean;
    message: string;
    data: T;
}

export class ApiResponse {
    /**
     * 成功响应快捷方法
     * @param code 业务状态码, 默认 200
     * @param messgae 提示信息, 默认 success
     * @param data 返回给前端的数据
     */
    static success<T>(
        data: T,
        message: string = 'success',
        code: number = 200,
    ): IResponse<T> {
        return {
            success: true,
            code,
            message,
            data,
        };
    }
    /**
     * 无数据的快捷响应（删除）
     */
    static ok(message: string = '操作成功'): IResponse<null> {
        return {
            success: true,
            code: 200,
            message,
            data: null,
        };
    }
}
