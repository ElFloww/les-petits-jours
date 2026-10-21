CREATE TABLE [dbo].[Users]
(
    [Id] UNIQUEIDENTIFIER NOT NULL,
    [Username] NVARCHAR(40) NOT NULL,
    [Email] NVARCHAR(254) NULL,
    [DisplayName] NVARCHAR(80) NOT NULL,
    [PasswordHash] NVARCHAR(512) NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [DF_Users_IsActive] DEFAULT (0),
    [IsAdmin] BIT NOT NULL CONSTRAINT [DF_Users_IsAdmin] DEFAULT (0),
    CONSTRAINT [PK_Users] PRIMARY KEY ([Id]),
    CONSTRAINT [CK_Users_ActivePassword] CHECK ([IsActive] = 0 OR [PasswordHash] IS NOT NULL)
);
GO
CREATE UNIQUE INDEX [IX_Users_Username] ON [dbo].[Users] ([Username]);
GO
CREATE UNIQUE INDEX [IX_Users_Email] ON [dbo].[Users] ([Email]) WHERE [Email] IS NOT NULL;
