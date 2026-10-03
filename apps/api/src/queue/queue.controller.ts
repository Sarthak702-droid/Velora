import { ReceiptService } from "../security/receipt.service";
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  ForbiddenException,
} from "@nestjs/common";
import { QueueService } from "./queue.service";
import {
  JoinQueueRequestDto,
  ReorderQueueDto,
  UpdateQueueStatusDto,
} from "./dto/queue.dto";
import {
  Public,
  Roles,
  RequireFeature,
} from "../common/decorators/metadata.decorator";
import {
  CurrentTenant,
  CurrentUser,
} from "../common/decorators/current.decorator";
import { UserRole } from "@prisma/client";

@Controller("queue")
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly receipts: ReceiptService,
  ) {}

  @Public()
  @Post("join")
  @RequireFeature("queue.live")
  async joinQueue(
    @CurrentTenant() tenantId: string,
    @Body() dto: JoinQueueRequestDto,
    @CurrentUser() user: any,
  ) {
    const entry = await this.queueService.joinQueue(
      tenantId,
      dto,
      user?.id,
      user?.name,
      user?.role || "CUSTOMER",
    );
    return {
      id: entry.id,
      tokenNumber: entry.tokenNumber,
      managementReceipt: this.receipts.issue("queue", tenantId, entry.id),
    };
  }

  @Public()
  @Get("status/:token")
  async getPublicQueueStatus(
    @CurrentTenant() tenantId: string,
    @Param("token") tokenNumber: string,
  ) {
    throw new ForbiddenException(
      "Use your private queue receipt to track this visit",
    );
  }

  @Public()
  @Get("track/:id")
  async track(
    @CurrentTenant() tenantId: string,
    @Param("id") id: string,
    @Headers("x-private-receipt") receipt: string,
  ) {
    this.receipts.verify("queue", tenantId, id, receipt);
    return this.queueService.getPrivateQueueStatus(tenantId, id);
  }

  @Public()
  @Patch(":id/leave")
  async leave(
    @CurrentTenant() tenantId: string,
    @Param("id") id: string,
    @Headers("x-private-receipt") receipt: string,
  ) {
    this.receipts.verify("queue", tenantId, id, receipt);
    return this.queueService.updateQueueStatus(
      tenantId,
      id,
      "LEFT",
      undefined,
      "Customer",
      "CUSTOMER",
    );
  }

  @Get("branch/:branchId")
  @Roles(
    UserRole.SALON_OWNER,
    UserRole.BRANCH_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.PROFESSIONAL,
  )
  async getBranchQueue(
    @CurrentTenant() tenantId: string,
    @Param("branchId") branchId: string,
  ) {
    return this.queueService.getBranchQueue(tenantId, branchId);
  }

  @Patch(":id/reorder")
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST)
  async reorderQueue(
    @CurrentTenant() tenantId: string,
    @Param("id") entryId: string,
    @Body() dto: ReorderQueueDto,
    @CurrentUser() user: any,
  ) {
    return this.queueService.reorderQueue(
      tenantId,
      entryId,
      dto.newPosition,
      dto.reason,
      user.id,
      user.name,
      user.role,
    );
  }

  @Patch(":id/status")
  @Roles(
    UserRole.SALON_OWNER,
    UserRole.BRANCH_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.PROFESSIONAL,
  )
  async updateQueueStatus(
    @CurrentTenant() tenantId: string,
    @Param("id") entryId: string,
    @Body() dto: UpdateQueueStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.queueService.updateQueueStatus(
      tenantId,
      entryId,
      dto.status,
      user.id,
      user.name,
      user.role,
      dto.staffId,
    );
  }
}
