SET NOCOUNT ON;
INSERT INTO [dbo].[Users] ([Id], [Username], [DisplayName], [IsActive])
SELECT seed.[Id], seed.[Username], seed.[DisplayName], 0
FROM (VALUES
    (CONVERT(UNIQUEIDENTIFIER, 'a1111111-1111-4111-8111-111111111111'), N'louisa', N'Louisa'),
    (CONVERT(UNIQUEIDENTIFIER, 'b2222222-2222-4222-8222-222222222222'), N'orleane', N'Orléane'),
    (CONVERT(UNIQUEIDENTIFIER, 'c3333333-3333-4333-8333-333333333333'), N'thomas', N'Thomas')
) AS seed ([Id], [Username], [DisplayName])
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Users] existing WHERE existing.[Username] = seed.[Username]);
