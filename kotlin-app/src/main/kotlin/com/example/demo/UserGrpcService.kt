package com.example.demo

import io.grpc.Status
import io.grpc.stub.StreamObserver
import net.devh.boot.grpc.server.service.GrpcService
import user.UserOuterClass
import user.UserServiceGrpc

@GrpcService
class UserGrpcService : UserServiceGrpc.UserServiceImplBase() {

    override fun getUser(
        request: UserOuterClass.UserIdRequest,
        responseObserver: StreamObserver<UserOuterClass.User>
    ) {
        val user = MockData.users.find { it.id == request.id }
        if (user == null) {
            responseObserver.onError(
                Status.NOT_FOUND
                    .withDescription("User with id ${request.id} not found")
                    .asRuntimeException()
            )
            return
        }

        val pbUser = UserOuterClass.User.newBuilder()
            .setId(user.id)
            .setName(user.name)
            .setEmail(user.email)
            .setAge(user.age)
            .setAddress(user.address)
            .setPhone(user.phone)
            .setDepartment(user.department)
            .setRole(user.role)
            .setSalary(user.salary)
            .setIsActive(user.isActive)
            .setJoinedDate(user.joinedDate)
            .addAllSkills(user.skills)
            .build()

        responseObserver.onNext(pbUser)
        responseObserver.onCompleted()
    }

    override fun getUsers(
        request: UserOuterClass.Empty,
        responseObserver: StreamObserver<UserOuterClass.UserList>
    ) {
        val pbUsers = MockData.users.map { user ->
            UserOuterClass.User.newBuilder()
                .setId(user.id)
                .setName(user.name)
                .setEmail(user.email)
                .setAge(user.age)
                .setAddress(user.address)
                .setPhone(user.phone)
                .setDepartment(user.department)
                .setRole(user.role)
                .setSalary(user.salary)
                .setIsActive(user.isActive)
                .setJoinedDate(user.joinedDate)
                .addAllSkills(user.skills)
                .build()
        }

        val userList = UserOuterClass.UserList.newBuilder()
            .addAllUsers(pbUsers)
            .build()

        responseObserver.onNext(userList)
        responseObserver.onCompleted()
    }

    override fun searchUsers(
        request: UserOuterClass.SearchRequest,
        responseObserver: StreamObserver<UserOuterClass.UserList>
    ) {
        val criteria = SearchCriteria(
            name = request.name.takeIf { it.isNotEmpty() },
            minAge = request.minAge.takeIf { it > 0 },
            maxAge = request.maxAge.takeIf { it > 0 },
            department = request.department.takeIf { it.isNotEmpty() }
        )

        val results = MockData.filterUsers(criteria)
        val pbUsers = results.map { user ->
            UserOuterClass.User.newBuilder()
                .setId(user.id)
                .setName(user.name)
                .setEmail(user.email)
                .setAge(user.age)
                .setAddress(user.address)
                .setPhone(user.phone)
                .setDepartment(user.department)
                .setRole(user.role)
                .setSalary(user.salary)
                .setIsActive(user.isActive)
                .setJoinedDate(user.joinedDate)
                .addAllSkills(user.skills)
                .build()
        }

        val userList = UserOuterClass.UserList.newBuilder()
            .addAllUsers(pbUsers)
            .build()

        responseObserver.onNext(userList)
        responseObserver.onCompleted()
    }
}
