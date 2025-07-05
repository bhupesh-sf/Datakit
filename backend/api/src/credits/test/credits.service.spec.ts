import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreditsService } from 'src/credits/credits.service';
import { CreditUsage } from 'src/credits/entities/credit-usage.entity';
import { SubscriptionsService } from 'src/subscriptions/subscriptions.service';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import { UsersService } from 'src/users/users.service';

describe('CreditsService', () => {
  let service: CreditsService;
  let creditUsageRepository: Repository<CreditUsage>;
  let subscriptionsService: SubscriptionsService;
  let workspacesService: WorkspacesService;
  let usersService: UsersService;

  const mockCreditUsageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    })),
  };

  const mockSubscriptionsService = {
    findByWorkspaceId: jest.fn(),
    getCreditsRemaining: jest.fn(),
    useWorkspaceCredits: jest.fn(),
    useCredits: jest.fn(),
  };

  const mockWorkspacesService = {
    getWorkspace: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        {
          provide: getRepositoryToken(CreditUsage),
          useValue: mockCreditUsageRepository,
        },
        {
          provide: SubscriptionsService,
          useValue: mockSubscriptionsService,
        },
        {
          provide: WorkspacesService,
          useValue: mockWorkspacesService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
    creditUsageRepository = module.get<Repository<CreditUsage>>(
      getRepositoryToken(CreditUsage),
    );
    subscriptionsService =
      module.get<SubscriptionsService>(SubscriptionsService);
    workspacesService = module.get<WorkspacesService>(WorkspacesService);
    usersService = module.get<UsersService>(UsersService);

    // Clear all mocks between tests
    jest.clearAllMocks();
  });

  describe('calculateCredits', () => {
    it('should calculate credits for datakit-smart model', () => {
      const credits = service.calculateCredits('datakit-smart', 1000, 500);
      // datakit-smart: 0.3 per 1K input, 1.5 per 1K output
      // (1000/1000 * 0.3) + (500/1000 * 1.5) = 0.3 + 0.75 = 1.05
      expect(credits).toBe(1.05);
    });

    it('should calculate credits for datakit-fast model', () => {
      const credits = service.calculateCredits('datakit-fast', 2000, 1000);
      // datakit-fast: 0.08 per 1K input, 0.4 per 1K output
      // (2000/1000 * 0.08) + (1000/1000 * 0.4) = 0.16 + 0.4 = 0.56
      expect(credits).toBe(0.56);
    });

    it('should handle decimal token counts', () => {
      const credits = service.calculateCredits('datakit-smart', 477.5, 210);
      // (477.5/1000 * 0.3) + (210/1000 * 1.5) = 0.14325 + 0.315 = 0.45825
      expect(credits).toBeCloseTo(0.4583, 3);
    });

    it('should return 0 for free models', () => {
      const credits = service.calculateCredits('llama-3.1-70b', 1000, 1000);
      expect(credits).toBe(0);
    });

    it('should handle unknown models with default pricing', () => {
      const credits = service.calculateCredits('unknown-model', 1000, 1000);
      // Should use a default pricing (check implementation)
      expect(credits).toBeGreaterThan(0);
    });
  });

  describe('checkCredits', () => {
    it('should return true when user has sufficient credits', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: 'workspace-id',
      });
      mockSubscriptionsService.findByWorkspaceId.mockResolvedValue({
        creditsRemaining: 100,
      });

      const result = await service.checkCredits('user-id', 10);
      expect(result).toBe(true);
    });

    it('should return true when user has unlimited credits (-1)', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: 'workspace-id',
      });
      mockSubscriptionsService.findByWorkspaceId.mockResolvedValue({
        creditsRemaining: -1,
      });

      const result = await service.checkCredits('user-id', 10000);
      expect(result).toBe(true);
    });

    it('should return false when user has insufficient credits', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: 'workspace-id',
      });
      mockSubscriptionsService.findByWorkspaceId.mockResolvedValue({
        creditsRemaining: 5,
      });

      const result = await service.checkCredits('user-id', 10);
      expect(result).toBe(false);
    });

    it('should check workspace credits when user has currentWorkspaceId', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: 'workspace-id',
      });
      mockSubscriptionsService.findByWorkspaceId.mockResolvedValue({
        creditsRemaining: 100,
      });

      await service.checkCredits('user-id', 10);

      expect(subscriptionsService.findByWorkspaceId).toHaveBeenCalledWith(
        'workspace-id',
      );
    });

    it('should fallback to user subscription when no workspace', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: null,
      });
      mockSubscriptionsService.getCreditsRemaining.mockResolvedValue(100);

      await service.checkCredits('user-id', 10);

      expect(subscriptionsService.getCreditsRemaining).toHaveBeenCalledWith(
        'user-id',
      );
    });
  });

  describe('recordUsage', () => {
    it('should create credit usage record with all fields', async () => {
      const userId = 'user-id';
      const workspaceId = 'workspace-id';
      const model = 'datakit-smart';
      const provider = 'datakit';
      const inputTokens = 477.5;
      const outputTokens = 210;
      const prompt = 'Test prompt';
      const response = 'Test response';

      mockUsersService.findOne.mockResolvedValue({
        id: userId,
        currentWorkspaceId: workspaceId,
      });
      mockSubscriptionsService.useWorkspaceCredits.mockResolvedValue(true);
      mockCreditUsageRepository.save.mockResolvedValue({ id: 'usage-id' });

      await service.recordUsage(
        userId,
        model,
        provider,
        inputTokens,
        outputTokens,
        prompt,
        response,
      );

      expect(creditUsageRepository.create).toHaveBeenCalledWith({
        userId,
        workspaceId,
        modelId: model,
        provider,
        inputTokens,
        outputTokens,
        creditsUsed: expect.any(Number),
        prompt,
        response,
      });
      expect(creditUsageRepository.save).toHaveBeenCalled();
    });

    it('should handle decimal credit values correctly', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: 'workspace-id',
      });
      mockSubscriptionsService.useWorkspaceCredits.mockResolvedValue(true);

      await service.recordUsage(
        'user-id',
        'datakit-smart',
        'datakit',
        477.5,
        210,
        'prompt',
        'response',
      );

      const createCall = mockCreditUsageRepository.create.mock.calls[0][0];
      expect(createCall.creditsUsed).toBeCloseTo(0.4583, 3);
    });

    it('should deduct credits from workspace subscription', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: 'workspace-id',
      });
      mockSubscriptionsService.useWorkspaceCredits.mockResolvedValue(true);

      await service.recordUsage(
        'user-id',
        'datakit-smart',
        'datakit',
        1000,
        500,
        'prompt',
        'response',
      );

      expect(subscriptionsService.useWorkspaceCredits).toHaveBeenCalledWith(
        'workspace-id',
        1.05, // calculated credits
      );
    });
  });

  describe('getRemainingCredits', () => {
    it('should return remaining credits from workspace subscription', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: 'workspace-id',
      });
      mockSubscriptionsService.findByWorkspaceId.mockResolvedValue({
        creditsRemaining: 314.6049,
      });

      const result = await service.getRemainingCredits('user-id');
      expect(result).toBe(314.6049);
    });

    it('should fallback to user credits when no workspace', async () => {
      mockUsersService.findOne.mockResolvedValue({
        id: 'user-id',
        currentWorkspaceId: null,
      });
      mockSubscriptionsService.getCreditsRemaining.mockResolvedValue(100);

      const result = await service.getRemainingCredits('user-id');
      expect(result).toBe(100);
    });
  });

  describe('getUserUsageHistory', () => {
    it('should return paginated usage history', async () => {
      const mockHistory = [
        { id: '1', createdAt: new Date() },
        { id: '2', createdAt: new Date() },
      ];
      mockCreditUsageRepository.findAndCount.mockResolvedValue([
        mockHistory,
        10,
      ]);

      const result = await service.getUserUsageHistory('user-id', 5, 0);

      expect(result).toEqual([mockHistory, 10]);
      expect(creditUsageRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
        order: { createdAt: 'DESC' },
        take: 5,
        skip: 0,
      });
    });
  });

  describe('getUserUsageStats', () => {
    it('should calculate usage statistics correctly', async () => {
      const mockUsages = [
        {
          creditsUsed: 10.5,
          inputTokens: 1000,
          outputTokens: 500,
          modelId: 'datakit-smart',
          provider: 'datakit',
        },
        {
          creditsUsed: 5.25,
          inputTokens: 2000,
          outputTokens: 1000,
          modelId: 'datakit-fast',
          provider: 'datakit',
        },
        {
          creditsUsed: 8.0,
          inputTokens: 1500,
          outputTokens: 750,
          modelId: 'datakit-smart',
          provider: 'datakit',
        },
      ];
      mockCreditUsageRepository.find.mockResolvedValue(mockUsages);

      const result = await service.getUserUsageStats('user-id');

      expect(result).toEqual({
        totalCreditsUsed: 23.75,
        totalInputTokens: 4500,
        totalOutputTokens: 2250,
        usageByModel: {
          'datakit-smart': 18.5,
          'datakit-fast': 5.25,
        },
        usageByProvider: {
          datakit: 23.75,
        },
      });
    });
  });
});
