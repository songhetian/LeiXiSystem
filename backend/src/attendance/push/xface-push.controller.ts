// XFace600 / ZKTeco PUSH 接收端点
// 真机出厂 Push 协议：设备主动 POST /iclock/cdata?SN=XXXX&table=ATTLOG&options=...
// 该端点为设备直连，不套 /api/v1 前缀（在 setGlobalPrefix 时通过 exclude 排除），
// 也不走 JWT 鉴权——设备用 SN + apiKey 自证身份。
// 设备只认 HTTP 200 + 纯文本 "OK"，故成功一律返回 text/plain "OK"。
// 注意：不能用方法级 @Header('Content-Type','text/plain')，否则异常过滤器
// 回写 JSON 对象时 Fastify 会因 text/plain 期望 string 而抛 FST_ERR_REP_INVALID_PAYLOAD_TYPE。
import {
  Controller,
  Post,
  Query,
  Body,
  Headers,
  HttpCode,
  Res,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { PrismaService } from '../../prisma/prisma.service';
import { ERROR_CODES } from '../../common/error-codes';
import { XFacePushService } from './xface-push.service';

@Controller('iclock/cdata')
export class XFacePushController {
  private readonly logger = new Logger(XFacePushController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: XFacePushService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleCdata(
    @Query('SN') sn: string | undefined,
    @Query('key') queryKey: string | undefined,
    @Headers('x-api-key') headerKey: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const deviceSn = (sn ?? '').trim();
    const apiKey = (queryKey || headerKey || '').trim();

    // 设备鉴权：用 apiKey 查 PunchDevice 表，匹配 SN（无 key 时回退按 SN 直查）
    const device = apiKey
      ? await this.prisma.punchDevice.findFirst({ where: { apiKey } })
      : await this.prisma.punchDevice.findUnique({ where: { deviceNo: deviceSn } });

    if (!device) {
      throw new UnauthorizedException({
        code: ERROR_CODES.PUNCH_DEVICE_ERROR,
        message: '未知打卡设备',
      });
    }
    if (device.deviceNo !== deviceSn) {
      throw new ForbiddenException({
        code: ERROR_CODES.DATA_NO_PERMISSION,
        message: '设备 SN 与 apiKey 不匹配',
      });
    }
    if (!device.enabled) {
      throw new ForbiddenException({
        code: ERROR_CODES.PUNCH_DEVICE_ERROR,
        message: '打卡设备已禁用',
      });
    }

    // 请求体为纯文本（text/plain）；兼容未解析/空体（设备心跳）
    const raw = typeof body === 'string' ? body : '';

    const parsed = this.pushService.parseCdataBody(raw, deviceSn);

    if (parsed.attlogs.length > 0) {
      const result = await this.pushService.syncToPunchLogs(parsed.attlogs, deviceSn);
      this.logger.log(
        `PUSH 接收 deviceSn=${deviceSn} attlogs=${parsed.attlogs.length} ` +
          `inserted=${result.inserted} skipped=${result.skipped}`,
      );
    }
    if (parsed.options.length > 0) {
      this.logger.debug(
        `PUSH OPTIONS deviceSn=${deviceSn}: ${parsed.options
          .map((o) => `${o.key}=${o.value}`)
          .join(', ')}`,
      );
    }

    // 设备只认 200 + "OK"（仅在成功路径设置 text/plain，避免污染异常响应）
    reply.header('Content-Type', 'text/plain');
    return 'OK';
  }
}
