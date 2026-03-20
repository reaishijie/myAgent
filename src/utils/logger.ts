// 终端颜色 ANSI 转义码
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context; // 上下文名称，比如 'UserService' 或 'HTTP'
  }

  // 格式化当前时间 (类似 3/20/2026, 11:47:47 AM)
  private getTimestamp(): string {
    return new Date().toLocaleString('en-US', { hour12: true });
  }

  // 核心打印逻辑
  private print(level: string, message: string, color: string) {
    const pid = process.pid;
    const timestamp = this.getTimestamp();
    
    // 完美复刻 NestJS 格式：[前缀] PID - 时间戳   级别 [上下文] 消息
    const prefix = `${colors.green}[Hono] ${pid}  -${colors.reset}`;
    const timeStr = `${timestamp}`;
    const levelStr = `${color}${level.padEnd(7)}${colors.reset}`;
    const contextStr = `${colors.yellow}[${this.context}]${colors.reset}`;
    const msgStr = `${color}${message}${colors.reset}`;

    console.log(`${prefix} ${timeStr}     ${levelStr} ${contextStr} ${msgStr}`);
  }

  log(message: string) {
    this.print('LOG', message, colors.green);
  }

  warn(message: string) {
    this.print('WARN', message, colors.yellow);
  }

  error(message: string, trace?: string) {
    this.print('ERROR', message, colors.red);
    if (trace) {
      console.error(`${colors.red}${trace}${colors.reset}`);
    }
  }

  debug(message: string) {
    this.print('DEBUG', message, colors.cyan);
  }
}