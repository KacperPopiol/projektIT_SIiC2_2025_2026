module.exports = (sequelize, DataTypes) => {
	const GroupEncryptedKey = sequelize.define(
		'GroupEncryptedKey',
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			group_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'groups',
					key: 'group_id',
				},
			},
			user_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			encrypted_key: {
				type: DataTypes.TEXT,
				allowNull: false,
				comment: 'Group AES key encrypted with user public key',
			},
		},
		{
			tableName: 'group_encrypted_keys',
			timestamps: true,
			underscored: true,
		}
	)

	return GroupEncryptedKey
}
